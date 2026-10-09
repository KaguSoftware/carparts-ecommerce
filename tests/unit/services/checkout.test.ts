import { CARD_OK, CUSTOMER_ID, freshSeed, STAFF, TR_ADDRESS, US_ADDRESS } from "../helpers/test-env";
import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { db } from "@/lib/db";
import { outboxDir } from "@/lib/email";
import * as cart from "@/lib/services/cart";
import * as checkout from "@/lib/services/checkout";
import * as inventory from "@/lib/services/inventory";
import * as orders from "@/lib/services/orders";
import * as settingsService from "@/lib/services/settings";
import type { PlaceOrderInput } from "@/lib/services/contracts";
import type { ProductVariant } from "@/lib/types/domain";

let spare = 0;
/** Distinct, well-stocked active variants so tests never fight over the same stock. */
async function variant(minStock = 15): Promise<ProductVariant> {
  const active = new Set((await db.products.find({ where: (p) => p.status === "active" })).map((p) => p.id));
  const all = await db.variants.find({ where: (v) => v.isActive && active.has(v.productId) && v.stockOnHand - v.stockReserved >= minStock && v.price >= 1500 && v.price <= 9000 && v.weightGrams < 1500 });
  return all[spare++ % all.length]!;
}

async function cartWith(items: { variant: ProductVariant; qty: number }[], userId: string | null = null) {
  const c = await cart.getOrCreateCart({ userId });
  for (const i of items) await cart.addItem(c.id, i.variant.id, i.qty);
  return c.id;
}

const key = () => randomUUID();

function input(cartId: string, extra: Partial<PlaceOrderInput> = {}): PlaceOrderInput {
  return {
    cartId,
    email: "shopper@example.com",
    shippingAddress: US_ADDRESS,
    shippingMethodId: "shp_standard",
    locale: "en",
    idempotencyKey: key(),
    payment: { type: "card", card: CARD_OK },
    ...extra,
  };
}

const live = async (id: string) => (await db.variants.get(id))!;
const emails = () => (fs.existsSync(outboxDir()) ? fs.readdirSync(outboxDir()).filter((n) => n.endsWith(".json")) : []);

beforeAll(async () => {
  await freshSeed();
}, 60_000);

describe("getCheckoutQuote", () => {
  it("computes subtotal, discount, shipping, tax and the charge amount server-side", async () => {
    const v = await variant();
    const cartId = await cartWith([{ variant: v, qty: 2 }]);
    await cart.applyCoupon(cartId, "WELCOME10");
    const quote = await checkout.getCheckoutQuote({ cartId, destination: { country: "US", region: "MI" }, shippingMethodId: "shp_standard", locale: "en" });

    const subtotal = v.price * 2;
    const discount = Math.round(subtotal * 0.1);
    expect(quote.totals.subtotal).toBe(subtotal);
    expect(quote.totals.discount).toBe(discount);
    const method = (await db.shippingMethods.get("shp_standard"))!;
    const extraKg = Math.max(0, Math.floor((v.weightGrams * 2) / 1000) - 1);
    const free = subtotal - discount >= (method.freeOverSubtotal ?? Infinity);
    const shipping = free ? 0 : method.price + method.perKgPrice * extraKg;
    expect(quote.totals.shipping).toBe(shipping);
    // Michigan: 6.00%, shipping not taxed
    expect(quote.taxRate?.rateBps).toBe(600);
    expect(quote.totals.tax).toBe(Math.round((subtotal - discount) * 0.06));
    expect(quote.totals.total).toBe(subtotal - discount + shipping + quote.totals.tax);
    expect(quote.charge).toEqual({ currency: "USD", fxRate: 1, amount: quote.totals.total });
    expect(quote.shippingQuotes.map((q) => q.code)).toEqual(expect.arrayContaining(["standard", "express", "pickup"]));
    expect(quote.shippingQuotes.find((q) => q.code === "international")).toBeUndefined();
  });

  it("converts the charge to TRY with the configured rate and uses Turkish shipping methods", async () => {
    const v = await variant();
    const cartId = await cartWith([{ variant: v, qty: 1 }]);
    const quote = await checkout.getCheckoutQuote({ cartId, destination: { country: "TR", region: "İstanbul" }, shippingMethodId: "shp_tr_standard", locale: "tr" });
    expect(quote.shippingQuotes.map((q) => q.code).sort()).toEqual(["tr-express", "tr-standard"]);
    expect(quote.taxRate?.rateBps).toBe(2000);
    expect(quote.charge.currency).toBe("TRY");
    expect(quote.charge.fxRate).toBe(45);
    expect(quote.charge.amount).toBe(Math.round(quote.totals.total * 45));
  });

  it("free shipping coupon zeroes the shipping line; unknown destinations have no quotes", async () => {
    const v = await variant();
    const cartId = await cartWith([{ variant: v, qty: 5 }]);
    await cart.applyCoupon(cartId, "FREESHIP");
    const quote = await checkout.getCheckoutQuote({ cartId, destination: { country: "US", region: "TX" }, shippingMethodId: "shp_express", locale: "en" });
    expect(quote.selectedShipping?.price).toBe(0);
    expect(quote.selectedShipping?.isFree).toBe(true);
    const nowhere = await checkout.getCheckoutQuote({ cartId, destination: { country: "JP" }, locale: "en" });
    expect(nowhere.shippingQuotes).toEqual([]);
    await expect(checkout.getCheckoutQuote({ cartId: (await cart.getOrCreateCart({})).id, destination: { country: "US" }, locale: "en" })).rejects.toMatchObject({ code: "cart_empty" });
  });
});

describe("placeOrder", () => {
  it("charges, commits stock, redeems the coupon, empties the cart and sends the confirmation", async () => {
    const v = await variant();
    const before = await live(v.id);
    const cartId = await cartWith([{ variant: v, qty: 3 }]);
    await cart.applyCoupon(cartId, "SAVE25").catch(() => undefined); // may be below the minimum: irrelevant here
    const couponBefore = (await db.coupons.findOne((c) => c.code === "FILTERS10"))!.usedCount;
    await cart.applyCoupon(cartId, "WELCOME10");
    const soldBefore = (await db.products.get(v.productId))!.soldCount;
    const mailBefore = emails().length;
    const numberBefore = (await settingsService.getSettings()).checkout.nextOrderNumber;

    const quote = await checkout.getCheckoutQuote({ cartId, destination: { country: "US", region: "MI" }, shippingMethodId: "shp_standard", locale: "en" });
    const result = await checkout.placeOrder(input(cartId, { expectedTotal: quote.totals.total, newsletterOptIn: true, customerNote: "Leave at the door" }));
    expect(result.status).toBe("succeeded");
    if (result.status !== "succeeded") return;
    const { order } = result;

    expect(order.number).toBe(`AX-${numberBefore}`);
    expect(order).toMatchObject({ status: "processing", paymentStatus: "paid", total: quote.totals.total, subtotal: quote.totals.subtotal, discount: quote.totals.discount, tax: quote.totals.tax, shipping: quote.totals.shipping, currency: "USD", fxRate: 1, chargedTotal: quote.totals.total, couponCode: "WELCOME10", customerNote: "Leave at the door" });
    expect(order.accessToken.length).toBeGreaterThan(30);
    // line money adds up exactly
    expect(order.items.reduce((s, i) => s + i.lineTotal, 0)).toBe(order.subtotal - order.discount);
    expect(order.items.reduce((s, i) => s + i.tax, 0)).toBe(order.tax);
    expect(order.items.reduce((s, i) => s + i.discount, 0)).toBe(order.discount);
    expect(order.events.map((e) => e.type)).toEqual(expect.arrayContaining(["created", "paid", "status_changed", "email_sent"]));

    const after = await live(v.id);
    expect(after.stockOnHand).toBe(before.stockOnHand - 3);
    expect(after.stockReserved).toBe(before.stockReserved); // reservation was consumed
    const movements = await db.inventoryMovements.find({ where: (m) => m.reference === order.number });
    expect(movements.map((m) => m.reason).sort()).toEqual(["reservation", "sale"]);
    expect((await db.products.get(v.productId))!.soldCount).toBe(soldBefore + 3);
    expect((await db.coupons.findOne((c) => c.code === "WELCOME10"))!.usedCount).toBeGreaterThan(0);
    expect(await db.couponRedemptions.count((r) => r.orderId === order.id)).toBe(1);
    expect((await db.coupons.findOne((c) => c.code === "FILTERS10"))!.usedCount).toBe(couponBefore);
    expect((await cart.getCartView(cartId))!.lines).toHaveLength(0);
    expect(await db.newsletter.findOne((n) => n.email === "shopper@example.com")).toBeTruthy();

    const payment = (await db.payments.get(order.paymentId!))!;
    expect(payment).toMatchObject({ status: "succeeded", amount: order.chargedTotal, currency: "USD", provider: "mock" });
    expect(payment.method).toMatchObject({ brand: "visa", last4: "4242" });
    expect(JSON.stringify(payment)).not.toContain("4242 4242");

    expect(emails().length).toBeGreaterThanOrEqual(mailBefore + 1);
    const confirmation = fs.readdirSync(outboxDir()).map((n) => JSON.parse(fs.readFileSync(`${outboxDir()}/${n}`, "utf8"))).find((m) => m.template === "order_confirmation" && m.subject.includes(order.number));
    expect(confirmation.to).toBe("shopper@example.com");
    expect(confirmation.html).toContain(order.number);
  });

  it("is idempotent: replaying the same key returns the same order without charging or decrementing twice", async () => {
    const v = await variant();
    const cartId = await cartWith([{ variant: v, qty: 2 }]);
    const body = input(cartId);
    const before = await live(v.id);
    const first = await checkout.placeOrder(body);
    const second = await checkout.placeOrder(body);
    expect(first.status).toBe("succeeded");
    expect(second.status).toBe("succeeded");
    expect((first as { order: { id: string } }).order.id).toBe((second as { order: { id: string } }).order.id);
    expect((await live(v.id)).stockOnHand).toBe(before.stockOnHand - 2);
    expect(await db.orders.count((o) => o.idempotencyKey === body.idempotencyKey)).toBe(1);
    expect(await db.payments.count((p) => p.orderId === (first as { order: { id: string } }).order.id)).toBe(1);
  });

  it("applies the TRY currency snapshot to the order", async () => {
    const v = await variant();
    const cartId = await cartWith([{ variant: v, qty: 1 }]);
    const result = await checkout.placeOrder(input(cartId, { locale: "tr", shippingAddress: TR_ADDRESS, shippingMethodId: "shp_tr_standard", email: "alici@example.com" }));
    expect(result.status).toBe("succeeded");
    const order = (result as { order: { currency: string; fxRate: number; chargedTotal: number; total: number } }).order;
    expect(order).toMatchObject({ currency: "TRY", fxRate: 45 });
    expect(order.chargedTotal).toBe(Math.round(order.total * 45));
    const payment = (await db.payments.findOne((p) => p.amount === order.chargedTotal && p.currency === "TRY"))!;
    expect(payment).toBeTruthy();
  });

  it("declined card: stock is released, order stays pending/failed, retry with the same key succeeds on the same order", async () => {
    const v = await variant();
    const before = await live(v.id);
    const cartId = await cartWith([{ variant: v, qty: 2 }]);
    const idempotencyKey = key();
    const declined = await checkout.placeOrder(input(cartId, { idempotencyKey, payment: { type: "card", card: { ...CARD_OK, number: "4000 0000 0000 0002" } } }));
    expect(declined).toMatchObject({ status: "failed", error: "payment_declined" });
    const failed = (declined as { order: { id: string; number: string; paymentStatus: string; status: string } }).order;
    expect(failed).toMatchObject({ status: "pending_payment", paymentStatus: "failed" });
    const mid = await live(v.id);
    expect(mid.stockOnHand).toBe(before.stockOnHand);
    expect(mid.stockReserved).toBe(before.stockReserved);
    expect((await cart.getCartView(cartId))!.lines).toHaveLength(1); // the cart survives a decline

    const retry = await checkout.placeOrder(input(cartId, { idempotencyKey }));
    expect(retry.status).toBe("succeeded");
    expect((retry as { order: { id: string; number: string } }).order.id).toBe(failed.id);
    expect((retry as { order: { number: string } }).order.number).toBe(failed.number);
    expect((await live(v.id)).stockOnHand).toBe(before.stockOnHand - 2);
    expect(await db.orders.count((o) => o.idempotencyKey === idempotencyKey)).toBe(1);
  });

  it.each([
    ["4000 0000 0000 9995", "payment_insufficient_funds"],
    ["4000 0000 0000 0069", "payment_expired_card"],
    ["4000 0000 0000 0119", "payment_failed"],
  ])("maps test card %s to %s", async (number, error) => {
    const v = await variant();
    const cartId = await cartWith([{ variant: v, qty: 1 }]);
    const result = await checkout.placeOrder(input(cartId, { payment: { type: "card", card: { ...CARD_OK, number } } }));
    expect(result).toMatchObject({ status: "failed", error });
  });

  it("3-D-Secure style flow: requires_action holds stock, replays hand back the challenge, completion pays", async () => {
    const v = await variant();
    const before = await live(v.id);
    const cartId = await cartWith([{ variant: v, qty: 2 }]);
    const body = input(cartId, { payment: { type: "card", card: { ...CARD_OK, number: "4000 0025 0000 3155" } } });
    const first = await checkout.placeOrder(body);
    expect(first.status).toBe("requires_action");
    if (first.status !== "requires_action") return;
    expect(first.order).toMatchObject({ status: "pending_payment", paymentStatus: "unpaid" });
    expect((await live(v.id)).stockReserved).toBe(before.stockReserved + 2);
    expect((await live(v.id)).stockOnHand).toBe(before.stockOnHand);

    const replay = await checkout.placeOrder(body);
    expect(replay).toMatchObject({ status: "requires_action", actionToken: first.actionToken });

    const access = { accessToken: first.order.accessToken };
    await expect(checkout.completePaymentAction({ orderNumber: first.order.number, actionToken: "forged", approved: true, access: { accessToken: "wrong" } })).rejects.toMatchObject({ code: "order_not_found" });
    const forged = await checkout.completePaymentAction({ orderNumber: first.order.number, actionToken: "forged", approved: true, access });
    expect(forged).toMatchObject({ status: "failed", error: "payment_authentication_failed" });
    expect((await live(v.id)).stockReserved).toBe(before.stockReserved); // failed auth released the hold

    // the customer retries the same checkout with a normal card
    const retry = await checkout.placeOrder({ ...body, payment: { type: "card", card: CARD_OK } });
    expect(retry.status).toBe("succeeded");
  });

  it("3-D-Secure approved completion commits stock exactly once", async () => {
    const v = await variant();
    const before = await live(v.id);
    const cartId = await cartWith([{ variant: v, qty: 1 }], CUSTOMER_ID);
    const first = await checkout.placeOrder(input(cartId, { userId: CUSTOMER_ID, email: "customer@apexline.example", payment: { type: "card", card: { ...CARD_OK, number: "4000 0000 0000 3220" } } }));
    expect(first.status).toBe("requires_action");
    if (first.status !== "requires_action") return;
    const done = await checkout.completePaymentAction({ orderNumber: first.order.number, actionToken: first.actionToken, approved: true, access: { userId: CUSTOMER_ID } });
    expect(done.status).toBe("succeeded");
    const again = await checkout.completePaymentAction({ orderNumber: first.order.number, actionToken: first.actionToken, approved: true, access: { userId: CUSTOMER_ID } });
    expect(again.status).toBe("succeeded");
    const after = await live(v.id);
    expect(after.stockOnHand).toBe(before.stockOnHand - 1);
    expect(after.stockReserved).toBe(before.stockReserved);
    expect((await db.orders.get(first.order.id))!.userId).toBe(CUSTOMER_ID);
    expect((await cart.getCartView(cartId))!.lines).toHaveLength(0);

    // rejecting the challenge is a payment failure
    const v2 = await variant();
    const c2 = await cartWith([{ variant: v2, qty: 1 }]);
    const pending = await checkout.placeOrder(input(c2, { payment: { type: "card", card: { ...CARD_OK, number: "4000 0025 0000 3155" } } }));
    if (pending.status !== "requires_action") throw new Error("expected requires_action");
    const rejected = await checkout.completePaymentAction({ orderNumber: pending.order.number, actionToken: pending.actionToken, approved: false, access: { accessToken: pending.order.accessToken } });
    expect(rejected).toMatchObject({ status: "failed", error: "payment_authentication_failed" });
  });

  it("two concurrent checkouts for the last unit: exactly one wins, stock never goes negative", async () => {
    const v = await variant();
    // leave exactly 1 available
    await inventory.setStock(v.id, (await live(v.id)).stockReserved + 1, "race test", STAFF);
    const cartA = await cartWith([{ variant: v, qty: 1 }]);
    const cartB = await cartWith([{ variant: v, qty: 1 }]);

    const results = await Promise.allSettled([checkout.placeOrder(input(cartA, { email: "a@example.com" })), checkout.placeOrder(input(cartB, { email: "b@example.com" }))]);
    const succeeded = results.filter((r) => r.status === "fulfilled" && r.value.status === "succeeded");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(succeeded).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: expect.stringMatching(/^(out_of_stock|insufficient_stock|cart_empty|variant_unavailable)$/) });
    const after = await live(v.id);
    expect(after.stockOnHand).toBe(after.stockReserved + 0);
    expect(after.stockOnHand - after.stockReserved).toBe(0);
    await inventory.setStock(v.id, after.stockReserved + 20, "cleanup", STAFF);
  });

  it("many parallel checkouts against limited stock never oversell", async () => {
    const v = await variant(30);
    await inventory.setStock(v.id, (await live(v.id)).stockReserved + 5, "race test", STAFF);
    const carts = await Promise.all(Array.from({ length: 8 }, () => cartWith([{ variant: v, qty: 1 }])));
    const results = await Promise.allSettled(carts.map((c, i) => checkout.placeOrder(input(c, { email: `p${i}@example.com` }))));
    const won = results.filter((r) => r.status === "fulfilled" && r.value.status === "succeeded").length;
    expect(won).toBe(5);
    const after = await live(v.id);
    expect(after.stockOnHand).toBe(after.stockReserved);
    await inventory.setStock(v.id, after.stockReserved + 20, "cleanup", STAFF);
  });

  it("rejects stale totals, empty carts, bad addresses/cards, closed guest checkout and maintenance mode", async () => {
    const v = await variant();
    const cartId = await cartWith([{ variant: v, qty: 1 }]);
    await expect(checkout.placeOrder(input(cartId, { expectedTotal: 1 }))).rejects.toMatchObject({ code: "price_changed" });
    await expect(checkout.placeOrder(input((await cart.getOrCreateCart({})).id))).rejects.toMatchObject({ code: "cart_empty" });
    await expect(checkout.placeOrder(input("crt_nope"))).rejects.toMatchObject({ code: "cart_not_found" });
    await expect(checkout.placeOrder(input(cartId, { shippingAddress: { ...US_ADDRESS, postalCode: "" } }))).rejects.toMatchObject({ code: "address_invalid" });
    await expect(checkout.placeOrder(input(cartId, { email: "not-an-email" }))).rejects.toMatchObject({ code: "validation_failed" });
    await expect(checkout.placeOrder(input(cartId, { idempotencyKey: "x" }))).rejects.toMatchObject({ code: "validation_failed" });
    await expect(checkout.placeOrder(input(cartId, { payment: { type: "card", card: { ...CARD_OK, number: "4242 4242 4242 4241" } } }))).rejects.toMatchObject({ code: "validation_failed", fieldErrors: { "payment.card.number": ["card_number_invalid"] } });
    await expect(checkout.placeOrder(input(cartId, { payment: { type: "card", card: { ...CARD_OK, expYear: 2020 } } }))).rejects.toMatchObject({ fieldErrors: { "payment.card.expiry": ["card_expiry_invalid"] } });
    await expect(checkout.placeOrder(input(cartId, { shippingAddress: { ...US_ADDRESS, country: "JP" } }))).rejects.toMatchObject({ code: "shipping_unavailable" });
    await expect(checkout.placeOrder(input(cartId, { shippingMethodId: "shp_tr_standard" }))).rejects.toMatchObject({ code: "shipping_unavailable" });
    await expect(checkout.placeOrder(input(cartId, { shippingMethodId: "shp_nope" }))).rejects.toMatchObject({ code: "shipping_method_invalid" });

    await settingsService.updateSettings({ checkout: { guestCheckout: false } }, STAFF);
    await expect(checkout.placeOrder(input(cartId))).rejects.toMatchObject({ code: "guest_checkout_disabled" });
    await settingsService.updateSettings({ checkout: { guestCheckout: true }, maintenanceMode: true }, STAFF);
    await expect(checkout.placeOrder(input(cartId))).rejects.toMatchObject({ code: "maintenance" });
    await settingsService.updateSettings({ maintenanceMode: false }, STAFF);
    // nothing above created an order or reserved stock
    expect(await db.orders.count((o) => o.email === "not-an-email")).toBe(0);
  });

  it("refuses a replayed key from a different customer", async () => {
    const v = await variant();
    const cartId = await cartWith([{ variant: v, qty: 1 }]);
    const body = input(cartId, { email: "owner@example.com" });
    await checkout.placeOrder(body);
    const other = await cartWith([{ variant: v, qty: 1 }]);
    await expect(checkout.placeOrder({ ...body, cartId: other, email: "thief@example.com" })).rejects.toMatchObject({ code: "duplicate_order" });
  });

  it("expired unpaid checkouts release their reserved stock and are cancelled", async () => {
    const v = await variant();
    const before = await live(v.id);
    const cartId = await cartWith([{ variant: v, qty: 2 }]);
    const pending = await checkout.placeOrder(input(cartId, { payment: { type: "card", card: { ...CARD_OK, number: "4000 0025 0000 3155" } } }));
    if (pending.status !== "requires_action") throw new Error("expected requires_action");
    expect((await live(v.id)).stockReserved).toBe(before.stockReserved + 2);

    expect(await inventory.releaseExpiredReservations()).toBe(0); // still inside the window
    await db.orders.update(pending.order.id, { createdAt: new Date(Date.now() - 45 * 60_000).toISOString(), updatedAt: new Date(Date.now() - 45 * 60_000).toISOString() });
    expect(await inventory.releaseExpiredReservations()).toBeGreaterThanOrEqual(1);
    expect((await live(v.id)).stockReserved).toBe(before.stockReserved);
    expect((await db.orders.get(pending.order.id))!.status).toBe("cancelled");
    const lookup = await orders.getOrderByNumber(pending.order.number, { staff: true });
    expect(lookup!.events.at(-1)).toMatchObject({ type: "cancelled" });
  });
});

import { ADMIN, CARD_OK, CUSTOMER_ID, freshSeed, STAFF, US_ADDRESS } from "../helpers/test-env";
import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { db } from "@/lib/db";
import { outboxDir } from "@/lib/email";
import { canTransition, nextStatuses, ORDER_STATUSES } from "@/lib/order-status";
import * as cart from "@/lib/services/cart";
import * as checkout from "@/lib/services/checkout";
import * as orders from "@/lib/services/orders";
import type { Order, OrderStatus, ProductVariant } from "@/lib/types/domain";

let spare = 20;
async function variant(): Promise<ProductVariant> {
  const active = new Set((await db.products.find({ where: (p) => p.status === "active" })).map((p) => p.id));
  const all = await db.variants.find({ where: (v) => v.isActive && active.has(v.productId) && v.stockOnHand - v.stockReserved >= 15 && v.price >= 2000 && v.price <= 9000 && v.weightGrams < 1500 });
  return all[spare++ % all.length]!;
}

/** Places a real paid order (status processing) through checkout. */
async function placeOrder(opts: { qty?: number[]; userId?: string; email?: string; coupon?: string; cardNumber?: string } = {}): Promise<Order> {
  const qtys = opts.qty ?? [2];
  const c = await cart.getOrCreateCart({ userId: opts.userId ?? null });
  for (const qty of qtys) await cart.addItem(c.id, (await variant()).id, qty);
  if (opts.coupon) await cart.applyCoupon(c.id, opts.coupon, opts.userId);
  const result = await checkout.placeOrder({
    cartId: c.id,
    userId: opts.userId ?? null,
    email: opts.email ?? (opts.userId ? "customer@apexline.example" : "buyer@example.com"),
    shippingAddress: US_ADDRESS,
    shippingMethodId: "shp_standard",
    locale: "en",
    idempotencyKey: randomUUID(),
    payment: { type: "card", card: { ...CARD_OK, ...(opts.cardNumber ? { number: opts.cardNumber } : {}) } },
  });
  if (result.status !== "succeeded") throw new Error(`placeOrder: ${result.status}`);
  return result.order;
}

const fresh = async (id: string) => (await db.orders.get(id))!;
const stock = async (variantId: string) => (await db.variants.get(variantId))!;
const mail = () => fs.readdirSync(outboxDir()).map((n) => JSON.parse(fs.readFileSync(`${outboxDir()}/${n}`, "utf8")) as { template: string; subject: string; to: string });

beforeAll(async () => {
  await freshSeed();
}, 60_000);

describe("status graph", () => {
  it("matches the documented transitions exactly", () => {
    const allowed: Record<OrderStatus, OrderStatus[]> = {
      pending_payment: ["processing", "cancelled"],
      processing: ["shipped", "cancelled"],
      shipped: ["delivered"],
      delivered: ["refunded"],
      cancelled: [],
      refunded: [],
    };
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) expect(canTransition(from, to), `${from} -> ${to}`).toBe(allowed[from].includes(to));
      expect([...nextStatuses(from)]).toEqual(allowed[from]);
    }
  });

  it("is enforced by updateOrderStatus", async () => {
    const order = await placeOrder();
    for (const bad of ["delivered", "refunded", "pending_payment", "processing"] as const) {
      await expect(orders.updateOrderStatus(order.id, bad, STAFF), bad).rejects.toMatchObject({ code: "invalid_status_transition" });
    }
    const shipped = await orders.updateOrderStatus(order.id, "shipped", STAFF, "Handed to carrier");
    expect(shipped.status).toBe("shipped");
    await expect(orders.updateOrderStatus(order.id, "cancelled", STAFF)).rejects.toMatchObject({ code: "invalid_status_transition" });
    await expect(orders.updateOrderStatus(order.id, "processing", STAFF)).rejects.toMatchObject({ code: "invalid_status_transition" });
    const delivered = await orders.updateOrderStatus(order.id, "delivered", STAFF);
    expect(delivered.status).toBe("delivered");
    expect(delivered.deliveredAt).toBeTruthy();
    await expect(orders.updateOrderStatus("ord_nope", "shipped", STAFF)).rejects.toMatchObject({ code: "order_not_found" });
    const audits = await db.auditLog.find({ where: (a) => a.entityId === order.id && a.action === "order.status_change" });
    expect(audits.length).toBe(2);
  });

  it("a manual transition from pending_payment to processing marks the order paid and commits stock", async () => {
    const v = await variant();
    const c = await cart.getOrCreateCart({});
    await cart.addItem(c.id, v.id, 2);
    const before = await stock(v.id);
    const declined = await checkout.placeOrder({
      cartId: c.id,
      email: "phone@example.com",
      shippingAddress: US_ADDRESS,
      shippingMethodId: "shp_standard",
      locale: "en",
      idempotencyKey: randomUUID(),
      payment: { type: "card", card: { ...CARD_OK, number: "4000 0000 0000 0002" } },
    });
    if (declined.status !== "failed" || !declined.order) throw new Error("expected decline");
    const paid = await orders.updateOrderStatus(declined.order.id, "processing", STAFF, "Paid by bank transfer");
    expect(paid).toMatchObject({ status: "processing", paymentStatus: "paid" });
    const after = await stock(v.id);
    expect(after.stockOnHand).toBe(before.stockOnHand - 2);
    expect(after.stockReserved).toBe(before.stockReserved);
  });
});

describe("shipping and delivery", () => {
  it("markShipped stores carrier + tracking, emails the customer and allows amending the tracking number", async () => {
    const order = await placeOrder();
    await expect(orders.markShipped(order.id, { carrier: "", trackingNumber: "" }, STAFF)).rejects.toMatchObject({ code: "validation_failed" });
    const shipped = await orders.markShipped(order.id, { carrier: "UPS", trackingNumber: "1Z999AA10123456784" }, STAFF);
    expect(shipped).toMatchObject({ status: "shipped", carrier: "UPS", trackingNumber: "1Z999AA10123456784" });
    expect(shipped.shippedAt).toBeTruthy();
    expect(mail().some((m) => m.template === "shipping_update" && m.to === order.email && m.subject.includes(order.number))).toBe(true);

    const amended = await orders.markShipped(order.id, { carrier: "UPS", trackingNumber: "NEW-TRACKING", notifyCustomer: false }, STAFF);
    expect(amended.trackingNumber).toBe("NEW-TRACKING");
    expect(amended.status).toBe("shipped");
    expect(amended.shippedAt).toBe(shipped.shippedAt);

    await expect(orders.markDelivered(order.id, STAFF)).resolves.toMatchObject({ status: "delivered" });
    await expect(orders.markDelivered(order.id, STAFF)).rejects.toMatchObject({ code: "invalid_status_transition" });
    await expect(orders.markShipped(order.id, { carrier: "UPS", trackingNumber: "X" }, STAFF)).rejects.toMatchObject({ code: "invalid_status_transition" });
  });

  it("will not ship or deliver unpaid orders", async () => {
    const order = await db.orders.findOne((o) => o.status === "pending_payment" && o.paymentStatus === "failed");
    // seed data may have been expired already; create a failing checkout instead
    const target =
      order ??
      (await (async () => {
        const c = await cart.getOrCreateCart({});
        await cart.addItem(c.id, (await variant()).id, 1);
        const r = await checkout.placeOrder({ cartId: c.id, email: "x@example.com", shippingAddress: US_ADDRESS, shippingMethodId: "shp_standard", locale: "en", idempotencyKey: randomUUID(), payment: { type: "card", card: { ...CARD_OK, number: "4000 0000 0000 0002" } } });
        return (r as { order: Order }).order;
      })());
    await expect(orders.markShipped(target.id, { carrier: "UPS", trackingNumber: "1" }, STAFF)).rejects.toMatchObject({ code: "invalid_status_transition" });
  });
});

describe("cancellation", () => {
  it("cancelling a paid order refunds the card, restocks, un-counts the sale and releases the coupon", async () => {
    const order = await placeOrder({ qty: [2, 1], coupon: "WELCOME10" });
    const items = order.items.map((i) => i.variantId);
    const stockAfterSale = await Promise.all(items.map(stock));
    const sold = (await db.products.get(order.items[0]!.productId))!.soldCount;
    const redemptionsBefore = await db.couponRedemptions.count((r) => r.orderId === order.id);
    expect(redemptionsBefore).toBe(1);
    const usedBefore = (await db.coupons.findOne((c) => c.code === "WELCOME10"))!.usedCount;

    const cancelled = await orders.cancelOrder(order.id, { reason: "Customer changed their mind", restock: true, refund: true }, ADMIN);
    expect(cancelled).toMatchObject({ status: "cancelled", paymentStatus: "refunded", refundedTotal: order.total });
    const after = await Promise.all(items.map(stock));
    order.items.forEach((item, i) => expect(after[i]!.stockOnHand).toBe(stockAfterSale[i]!.stockOnHand + item.quantity));
    expect((await db.products.get(order.items[0]!.productId))!.soldCount).toBe(sold - order.items[0]!.quantity);
    expect(await db.couponRedemptions.count((r) => r.orderId === order.id)).toBe(0);
    expect((await db.coupons.findOne((c) => c.code === "WELCOME10"))!.usedCount).toBe(usedBefore - 1);

    const payment = (await db.payments.get(order.paymentId!))!;
    expect(payment.refunds).toHaveLength(1);
    expect(payment.refunds[0]).toMatchObject({ amount: order.total, amountCharged: order.chargedTotal, restock: true });
    expect(cancelled.items.every((i) => i.refundedQuantity === i.quantity)).toBe(true);
    expect(cancelled.events.map((e) => e.type)).toEqual(expect.arrayContaining(["refund", "cancelled"]));
    expect(mail().some((m) => m.template === "refund_notice" && m.subject.includes(order.number))).toBe(true);

    await expect(orders.cancelOrder(order.id, { reason: "again", restock: true, refund: true }, ADMIN)).rejects.toMatchObject({ code: "order_not_cancellable" });
    await expect(orders.cancelOrder(order.id, { reason: "", restock: true, refund: true }, ADMIN)).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("cancel without restock leaves the shelf count alone; cancel without refund keeps the payment", async () => {
    const a = await placeOrder({ qty: [1] });
    const va = await stock(a.items[0]!.variantId);
    await orders.cancelOrder(a.id, { reason: "Damaged in warehouse", restock: false, refund: true }, STAFF);
    expect((await stock(va.id)).stockOnHand).toBe(va.stockOnHand);

    const b = await placeOrder({ qty: [1] });
    const vb = await stock(b.items[0]!.variantId);
    const result = await orders.cancelOrder(b.id, { reason: "Refunded out of band", restock: true, refund: false }, STAFF);
    expect(result).toMatchObject({ status: "cancelled", paymentStatus: "paid", refundedTotal: 0 });
    expect((await stock(vb.id)).stockOnHand).toBe(vb.stockOnHand + 1);
    expect((await db.payments.get(b.paymentId!))!.refunds).toHaveLength(0);
  });

  it("shipped orders cannot be cancelled", async () => {
    const order = await placeOrder();
    await orders.markShipped(order.id, { carrier: "DHL", trackingNumber: "JD1" }, STAFF);
    await expect(orders.cancelOrder(order.id, { reason: "late", restock: true, refund: true }, STAFF)).rejects.toMatchObject({ code: "order_not_cancellable" });
  });

  it("customers can cancel their own pending/processing orders only", async () => {
    const mine = await placeOrder({ userId: CUSTOMER_ID });
    await expect(orders.cancelOwnOrder({ number: mine.number, userId: "usr_c01" })).rejects.toMatchObject({ code: "order_not_found" });
    const result = await orders.cancelOwnOrder({ number: mine.number, userId: CUSTOMER_ID, reason: "Ordered twice" });
    expect(result.status).toBe("cancelled");
    expect(result.internalNotes).toEqual([]);
    expect((await fresh(mine.id)).events.at(-1)).toMatchObject({ type: "cancelled", actor: { role: "customer" } });
    await expect(orders.cancelOwnOrder({ number: mine.number, userId: CUSTOMER_ID })).rejects.toMatchObject({ code: "order_not_cancellable" });

    const shipped = await placeOrder({ userId: CUSTOMER_ID });
    await orders.markShipped(shipped.id, { carrier: "UPS", trackingNumber: "T1" }, STAFF);
    await expect(orders.cancelOwnOrder({ number: shipped.number, userId: CUSTOMER_ID })).rejects.toMatchObject({ code: "order_not_cancellable" });
  });
});

describe("refunds", () => {
  it("partial refunds by item keep the status, restock and add up to the order total", async () => {
    const order = await placeOrder({ qty: [3, 2] });
    await orders.markShipped(order.id, { carrier: "UPS", trackingNumber: "R1" }, STAFF);
    await orders.markDelivered(order.id, STAFF);
    const [first, second] = order.items;
    const before = await stock(first!.variantId);

    const partial = await orders.refundOrder(order.id, { items: [{ orderItemId: first!.id, quantity: 1 }], reason: "One unit damaged", restock: true }, ADMIN);
    expect(partial.status).toBe("delivered");
    expect(partial.paymentStatus).toBe("partially_refunded");
    expect(partial.items[0]!.refundedQuantity).toBe(1);
    const unit = Math.round(((first!.lineTotal + first!.tax) * 1) / first!.quantity);
    expect(partial.refundedTotal).toBe(unit);
    expect((await stock(first!.variantId)).stockOnHand).toBe(before.stockOnHand + 1);

    await expect(orders.refundOrder(order.id, { items: [{ orderItemId: first!.id, quantity: 3 }], reason: "too many", restock: true }, ADMIN)).rejects.toMatchObject({ code: "quantity_invalid" });
    await expect(orders.refundOrder(order.id, { amount: order.total, reason: "too much", restock: false }, ADMIN)).rejects.toMatchObject({ code: "refund_exceeds_paid" });
    await expect(orders.refundOrder(order.id, { amount: 0, reason: "zero", restock: false }, ADMIN)).rejects.toMatchObject({ code: "validation_failed" });
    await expect(orders.refundOrder(order.id, { amount: 100, reason: "", restock: false }, ADMIN)).rejects.toMatchObject({ code: "validation_failed" });

    // remaining lines + shipping (once)
    const rest = await orders.refundOrder(
      order.id,
      { items: [{ orderItemId: first!.id, quantity: 2 }, { orderItemId: second!.id, quantity: 2 }], includeShipping: true, reason: "Return of the rest", restock: true },
      ADMIN,
    );
    expect(rest.refundedTotal).toBe(order.total);
    expect(rest.paymentStatus).toBe("refunded");
    expect(rest.status).toBe("refunded"); // fully refunded after delivery
    expect(rest.items.every((i) => i.refundedQuantity === i.quantity)).toBe(true);
    const payment = (await db.payments.get(order.paymentId!))!;
    expect(payment.refunds.reduce((s, r) => s + r.amount, 0)).toBe(order.total);
    expect(payment.refunds.reduce((s, r) => s + r.amountCharged, 0)).toBe(order.chargedTotal);
    await expect(orders.refundOrder(order.id, { amount: 1, reason: "again", restock: false }, ADMIN)).rejects.toMatchObject({ code: "invalid_status_transition" });
  });

  it("amount refunds work, never exceed what is left and charge the frozen exchange rate", async () => {
    const order = await placeOrder({ qty: [2] });
    const half = Math.floor(order.total / 2);
    const one = await orders.refundOrder(order.id, { amount: half, reason: "Goodwill", restock: false }, ADMIN);
    expect(one).toMatchObject({ paymentStatus: "partially_refunded", refundedTotal: half, status: "processing" });
    await expect(orders.refundOrder(order.id, { amount: order.total - half + 1, reason: "too much", restock: false }, ADMIN)).rejects.toMatchObject({ code: "refund_exceeds_paid" });
    // refunding the exact remainder completes it; before shipping that is a cancellation
    const done = await orders.refundOrder(order.id, { amount: order.total - half, reason: "Rest", restock: true }, ADMIN);
    expect(done).toMatchObject({ paymentStatus: "refunded", status: "cancelled", refundedTotal: order.total });
    expect(done.items.every((i) => i.refundedQuantity === i.quantity)).toBe(true);
  });

  it("a failing payment provider leaves the order untouched", async () => {
    const order = await placeOrder();
    const payment = (await db.payments.get(order.paymentId!))!;
    await db.payments.update(payment.id, { providerRef: "bogus_ref" });
    await expect(orders.refundOrder(order.id, { reason: "x", restock: true }, ADMIN)).rejects.toMatchObject({ code: "refund_failed" });
    expect(await fresh(order.id)).toMatchObject({ status: "processing", paymentStatus: "paid", refundedTotal: 0 });
    await db.payments.update(payment.id, { providerRef: payment.providerRef });
  });

  it("refunds of unpaid or already cancelled orders are rejected", async () => {
    const cancelled = (await db.orders.findOne((o) => o.status === "cancelled"))!;
    await expect(orders.refundOrder(cancelled.id, { reason: "x", restock: false }, ADMIN)).rejects.toMatchObject({ code: "invalid_status_transition" });
  });

  it("updateOrderStatus(refunded) from delivered issues a full refund with restock", async () => {
    const order = await placeOrder({ qty: [1] });
    await orders.markShipped(order.id, { carrier: "UPS", trackingNumber: "RR" }, STAFF);
    await orders.markDelivered(order.id, STAFF);
    const before = await stock(order.items[0]!.variantId);
    const refunded = await orders.updateOrderStatus(order.id, "refunded", ADMIN, "Customer return");
    expect(refunded).toMatchObject({ status: "refunded", paymentStatus: "refunded", refundedTotal: order.total });
    expect((await stock(before.id)).stockOnHand).toBe(before.stockOnHand + 1);
  });
});

describe("access control and listing", () => {
  it("returns an order only to its owner, a holder of the access token, or staff", async () => {
    const guest = await placeOrder({ email: "guest@example.com" });
    const mine = await placeOrder({ userId: CUSTOMER_ID });
    expect(await orders.getOrderByNumber(guest.number, { accessToken: guest.accessToken })).toMatchObject({ id: guest.id });
    expect(await orders.getOrderByNumber(guest.number, { accessToken: "nope" })).toBeNull();
    expect(await orders.getOrderByNumber(guest.number, { accessToken: "" })).toBeNull();
    expect(await orders.getOrderByNumber(guest.number, { userId: CUSTOMER_ID })).toBeNull();
    expect(await orders.getOrderByNumber(mine.number, { userId: CUSTOMER_ID })).toMatchObject({ id: mine.id });
    expect(await orders.getOrderByNumber(mine.number, { userId: "usr_c01" })).toBeNull();
    expect(await orders.getOrderByNumber(mine.number.toLowerCase(), { staff: true })).toMatchObject({ id: mine.id });
    expect(await orders.getOrderByNumber("AX-0", { staff: true })).toBeNull();
  });

  it("hides internal notes and staff identities from customers", async () => {
    const order = await placeOrder({ userId: CUSTOMER_ID });
    await orders.addOrderNote(order.id, "VIP, handle with care", STAFF);
    await orders.markShipped(order.id, { carrier: "UPS", trackingNumber: "N1" }, STAFF);
    const staffView = (await orders.getOrderByNumber(order.number, { staff: true }))!;
    expect(staffView.internalNotes).toHaveLength(1);
    const customerView = (await orders.getOrderByNumber(order.number, { userId: CUSTOMER_ID }))!;
    expect(customerView.internalNotes).toEqual([]);
    expect(JSON.stringify(customerView.events)).not.toContain(STAFF.email);
    await expect(orders.addOrderNote(order.id, "   ", STAFF)).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("guest tracking needs number AND email", async () => {
    const order = await placeOrder({ email: "Track.Me@Example.com" });
    expect(await orders.trackOrder({ number: order.number, email: "track.me@example.com" })).toMatchObject({ id: order.id });
    expect(await orders.trackOrder({ number: order.number, email: "other@example.com" })).toBeNull();
    expect(await orders.trackOrder({ number: "AX-1", email: "track.me@example.com" })).toBeNull();
    expect(await orders.trackOrder({ number: "", email: "" })).toBeNull();
  });

  it("lists a customer's orders newest first, paginated, without abandoned payment attempts", async () => {
    const list = await orders.listOrdersForUser(CUSTOMER_ID, { pageSize: 3 });
    expect(list.items.length).toBeLessThanOrEqual(3);
    expect(list.total).toBeGreaterThan(3);
    const dates = list.items.map((o) => o.createdAt);
    expect(dates).toEqual([...dates].sort().reverse());
    const all = await orders.listOrdersForUser(CUSTOMER_ID, { pageSize: 100 });
    expect(all.items.every((o) => o.userId === CUSTOMER_ID && !(o.status === "pending_payment" && o.paymentStatus === "failed"))).toBe(true);
  });

  it("knows who bought what", async () => {
    const order = await placeOrder({ userId: "usr_c05" });
    expect(await orders.hasUserPurchased("usr_c05", order.items[0]!.productId)).toBe(true);
    expect(await orders.hasUserPurchased("usr_c06", order.items[0]!.productId)).toBe(false);
    await orders.cancelOrder(order.id, { reason: "x", restock: true, refund: true }, STAFF);
    expect(await orders.hasUserPurchased("usr_c05", order.items[0]!.productId)).toBe(false);
  });

  it("admin list filters by status, text and date, sorts and paginates; export is safe CSV", async () => {
    const processing = await orders.adminListOrders({ status: "processing", pageSize: 100 });
    expect(processing.items.length).toBeGreaterThan(0);
    expect(processing.items.every((o) => o.status === "processing")).toBe(true);
    const target = processing.items[0]!;
    expect((await orders.adminListOrders({ q: target.number.toLowerCase() })).items.map((o) => o.id)).toContain(target.id);
    expect((await orders.adminListOrders({ q: target.email.toUpperCase() })).items.length).toBeGreaterThan(0);
    const asc = await orders.adminListOrders({ sort: "total_asc", pageSize: 100 });
    const totals = asc.items.map((o) => o.total);
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
    expect((await orders.adminListOrders({ from: new Date(Date.now() + 86_400_000).toISOString() })).total).toBe(0);
    expect((await orders.adminListOrders({ pageSize: 5 })).items).toHaveLength(5);

    const evil = await placeOrder({ email: "csv@example.com" });
    await orders.addOrderNote(evil.id, "n", STAFF);
    await db.orders.update(evil.id, { shippingAddress: { ...evil.shippingAddress, firstName: "=HYPERLINK(\"http://x\")" } });
    const csv = await orders.exportOrdersCsv({ q: "csv@example.com" });
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toContain("number,created_at,status");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("'=HYPERLINK");
  });
});

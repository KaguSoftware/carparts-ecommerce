import "server-only";
import { z } from "zod";
import { zodFieldErrors } from "@/lib/action-result";
import { createId, createToken, db } from "@/lib/db";
import { sendAdminNewOrder, sendOrderConfirmation } from "@/lib/email";
import { DomainError, isDomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { allocate, convertFromBase, currencyContextFor } from "@/lib/money";
import { createActionToken, getPaymentProvider, validateCard } from "@/lib/payments";
import type { PaymentWebhookEvent } from "@/lib/services/contracts";
import type { Actor, AddressInput, Cents, Id, Order, OrderItem, Payment } from "@/lib/types/domain";
import { addressInputSchema, emailSchema, localeSchema } from "@/lib/validation/common";
import type { CheckoutQuote, CheckoutQuoteInput, OrderAccess, PlaceOrderInput, PlaceOrderResult } from "./contracts";
import { priceCart, toCartView, type PricedCart } from "./_cart-pricing";
import { evaluateCoupon } from "./_coupon-rules";
import { redeemCoupon, releaseCouponRedemption } from "./coupons";
import { markOrderPaid,markPaymentFailed, stockItems, withEvent } from "./_order-lifecycle";
import { nowIso } from "./_shared";
import { createAddress, listAddresses } from "./accounts";
import { logAudit } from "./audit";
import { releaseExpiredReservations, releaseStock, reserveStock } from "./inventory";
import { getOrderByNumber } from "./orders";
import { subscribe } from "./newsletter";
import { allocateOrderNumber, getSettings } from "./settings";
import { getQuotes, methodServes, priceMethod } from "./shipping";
import { calculateTax } from "./tax";

const SYSTEM: Actor = { id: "system", role: "system" };

/* ------------------------------------------------------------------ pricing */

interface Totals {
  subtotal: Cents;
  discount: Cents;
  shipping: Cents;
  tax: Cents;
  total: Cents;
}

async function loadCart(cartId: Id) {
  const cart = await db.carts.get(cartId);
  if (!cart || Date.parse(cart.expiresAt) < Date.now()) throw new DomainError("cart_not_found", { status: 404 });
  return cart;
}

export async function getCheckoutQuote(input: CheckoutQuoteInput): Promise<CheckoutQuote> {
  const cart = await loadCart(input.cartId);
  const priced = await priceCart(cart, { userId: input.userId ?? cart.userId });
  if (priced.lines.length === 0) throw new DomainError("cart_empty", { status: 409 });
  const settings = priced.settings;
  const country = input.destination.country.trim().toUpperCase();
  const region = input.destination.region?.trim() ?? "";

  const afterDiscount = priced.subtotal - priced.discount;
  const shippingQuotes = settings.checkout.shippableCountries.includes(country)
    ? await getQuotes({ country, subtotal: afterDiscount, totalWeightGrams: priced.totalWeightGrams, freeShippingCoupon: priced.freeShipping })
    : [];
  const selectedShipping = input.shippingMethodId ? shippingQuotes.find((q) => q.methodId === input.shippingMethodId) : undefined;
  const shipping = selectedShipping?.price ?? 0;
  const { tax, rate } = await calculateTax({ country, region, taxableSubtotal: afterDiscount, shipping });
  const totals: Totals = { subtotal: priced.subtotal, discount: priced.discount, shipping, tax, total: afterDiscount + shipping + tax };

  const ctx = currencyContextFor(input.locale, settings.currency.tryPerUsd);
  const cartView = toCartView(cart.id, priced);
  cartView.totals = { ...cartView.totals, shipping, tax, total: totals.total };
  return {
    cart: cartView,
    shippingQuotes,
    ...(selectedShipping ? { selectedShipping } : {}),
    ...(rate ? { taxRate: { name: rate.name, rateBps: rate.rateBps } } : {}),
    totals,
    charge: { currency: ctx.currency, fxRate: ctx.rate, amount: convertFromBase(totals.total, ctx) },
  };
}

/* ------------------------------------------------------------------ input validation */

const cardSchema = z.object({
  type: z.literal("card"),
  card: z.object({
    number: z.string().min(12).max(30),
    expMonth: z.number().int(),
    expYear: z.number().int(),
    cvc: z.string().max(8),
    holder: z.string().trim().max(80),
  }),
});
const tokenSchema = z.object({ type: z.literal("token"), token: z.string().min(1).max(200) });

const placeOrderSchema = z.object({
  cartId: z.string().min(1, "required"),
  userId: z.string().nullish(),
  email: emailSchema,
  shippingAddress: addressInputSchema,
  billingAddress: addressInputSchema.optional(),
  shippingMethodId: z.string().min(1, "required"),
  locale: localeSchema,
  customerNote: z.string().trim().max(500, "too_long").optional(),
  idempotencyKey: z
    .string()
    .trim()
    .min(8, "too_short")
    .max(128, "too_long")
    .regex(/^[A-Za-z0-9._:-]+$/, "invalid_value"),
  payment: z.discriminatedUnion("type", [cardSchema, tokenSchema]),
  newsletterOptIn: z.boolean().optional(),
  saveAddress: z.boolean().optional(),
  expectedTotal: z.number().int().optional(),
});

function parsePlaceOrder(input: PlaceOrderInput) {
  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    const onlyAddress = Object.keys(fieldErrors).every((k) => k.startsWith("shippingAddress") || k.startsWith("billingAddress"));
    throw new DomainError(onlyAddress ? "address_invalid" : "validation_failed", { status: 400, fieldErrors });
  }
  const data = parsed.data;
  if (data.payment.type === "card") {
    const cardErrors = validateCard(data.payment.card);
    if (Object.keys(cardErrors).length) {
      throw new DomainError("validation_failed", { status: 400, fieldErrors: Object.fromEntries(Object.entries(cardErrors).map(([k, v]) => [`payment.card.${k}`, v])) });
    }
  }
  return data as typeof data & { shippingAddress: AddressInput; billingAddress?: AddressInput };
}

/* ------------------------------------------------------------------ place order */

type Prepared = { kind: "replay"; result: PlaceOrderResult } | { kind: "charge"; order: Order; payment: Payment; attempt: number; cartId: Id };

const FAILURE_ERROR: Record<string, string> = {
  card_declined: "payment_declined",
  insufficient_funds: "payment_insufficient_funds",
  expired_card: "payment_expired_card",
  processing_error: "payment_failed",
  authentication_failed: "payment_authentication_failed",
};

const failureError = (code: string): string => FAILURE_ERROR[code] ?? "payment_failed";

function assertCartStillValid(priced: PricedCart) {
  const lost = priced.warnings.find((w) => w.type === "item_removed" || w.type === "quantity_reduced");
  if (!lost) return;
  if (lost.type === "quantity_reduced") throw new DomainError("insufficient_stock", { status: 409, params: { available: lost.available } });
  if (lost.type === "item_removed") throw new DomainError(lost.reason === "out_of_stock" ? "out_of_stock" : "variant_unavailable", { status: 409 });
}

async function prepareOrder(data: ReturnType<typeof parsePlaceOrder>): Promise<Prepared> {
  const provider = getPaymentProvider();
  const settings = await getSettings();

  const existing = await db.orders.findOne((o) => o.idempotencyKey === data.idempotencyKey);
  let retry: Order | null = null;
  if (existing) {
    if ((existing.userId ?? null) !== (data.userId ?? null) || existing.email.toLowerCase() !== data.email) throw new DomainError("duplicate_order", { status: 409 });
    const wasPaid = existing.paymentStatus === "paid" || existing.paymentStatus === "partially_refunded" || existing.paymentStatus === "refunded";
    if (wasPaid) return { kind: "replay", result: { status: "succeeded", order: existing } };
    if (existing.status === "cancelled") {
      // Expired/cancelled unpaid order: free the key (old order stays for history) and start a fresh order.
      await db.orders.update(existing.id, { idempotencyKey: `${data.idempotencyKey}~${existing.number}` });
    } else {
      if (existing.status !== "pending_payment") throw new DomainError("duplicate_order", { status: 409 });
      const payment = existing.paymentId ? await db.payments.get(existing.paymentId) : null;
      if (existing.paymentStatus === "unpaid" && payment?.status === "requires_action") {
        return { kind: "replay", result: { status: "requires_action", order: existing, actionToken: createActionToken(payment.providerRef) } };
      }
      if (existing.paymentStatus === "unpaid" && Date.now() - Date.parse(existing.updatedAt) < 60_000) {
        throw new DomainError("duplicate_order", { status: 409 }); // another request with this key is still in flight
      }
      retry = existing;
      // Drop the hold from the earlier attempt so it does not count against the limits while re-pricing.
      await releaseCouponRedemption(existing.id);
    }
  }

  const cart = await loadCart(data.cartId);
  if (cart.userId && cart.userId !== (data.userId ?? null)) throw new DomainError("cart_not_found", { status: 404 });
  const priced = await priceCart(cart, { userId: data.userId, email: data.email });
  if (priced.lines.length === 0) throw new DomainError("cart_empty", { status: 409 });
  assertCartStillValid(priced);

  const country = data.shippingAddress.country;
  if (!settings.checkout.shippableCountries.includes(country)) throw new DomainError("shipping_unavailable", { status: 409 });
  const method = await db.shippingMethods.get(data.shippingMethodId);
  if (!method || !method.isActive) throw new DomainError("shipping_method_invalid", { status: 409 });
  if (!methodServes(method, country)) throw new DomainError("shipping_unavailable", { status: 409 });

  const afterDiscount = priced.subtotal - priced.discount;
  const quote = priceMethod(method, { country, subtotal: afterDiscount, totalWeightGrams: priced.totalWeightGrams, freeShippingCoupon: priced.freeShipping });
  const { tax } = await calculateTax({ country, region: data.shippingAddress.region, taxableSubtotal: afterDiscount, shipping: quote.price });
  const total = afterDiscount + quote.price + tax;
  if (data.expectedTotal !== undefined && data.expectedTotal !== total) throw new DomainError("price_changed", { status: 409, params: { total } });

  // Per-line allocation of the order-level discount and tax so refunds can be exact.
  const eligible = priced.application ? evaluateCoupon(priced.application.coupon, priced.couponLines, priced.subtotal).eligibleAmounts : priced.lines.map(() => 0);
  const discountByLine = priced.discount > 0 ? allocate(priced.discount, eligible) : priced.lines.map(() => 0);
  const nets = priced.lines.map((l, i) => l.lineTotal - (discountByLine[i] ?? 0));
  const taxByLine = tax > 0 ? allocate(tax, nets) : nets.map(() => 0);

  const ctx = currencyContextFor(data.locale, settings.currency.tryPerUsd);
  const chargedTotal = convertFromBase(total, ctx);
  const at = nowIso();
  const items: OrderItem[] = priced.lines.map((l, i) => ({
    id: createId("oit"),
    productId: l.productId,
    variantId: l.variantId,
    sku: l.sku,
    name: l.name,
    variantName: l.variantName,
    brandName: l.brandName,
    ...(l.image ? { image: l.image } : {}),
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    discount: discountByLine[i] ?? 0,
    tax: taxByLine[i] ?? 0,
    lineTotal: nets[i] ?? 0,
    refundedQuantity: 0,
  }));
  const billing = data.billingAddress ?? data.shippingAddress;
  const orderFields = {
    userId: data.userId ?? null,
    email: data.email,
    items,
    shippingAddress: data.shippingAddress,
    billingAddress: billing,
    shippingMethod: { id: method.id, code: method.code, name: method.name, price: quote.price, estimatedDaysMin: method.estimatedDaysMin, estimatedDaysMax: method.estimatedDaysMax },
    couponCode: priced.couponCode,
    subtotal: priced.subtotal,
    discount: priced.discount,
    shipping: quote.price,
    tax,
    total,
    currency: ctx.currency,
    fxRate: ctx.rate,
    chargedTotal,
    refundedTotal: 0,
    locale: data.locale,
    customerNote: data.customerNote || undefined,
    cartId: cart.id,
    updatedAt: at,
  };

  let order: Order;
  let payment: Payment;
  let attempt = 1;
  if (retry) {
    // Rebuild the failed attempt in place (same number, access token and idempotency key).
    if (retry.paymentStatus === "unpaid") await releaseStock(stockItems(retry), retry.number);
    attempt = retry.events.filter((e) => e.type === "payment_failed").length + 1;
    await reserveStock(stockItems({ items }), retry.number);
    order = await db.orders.update(retry.id, {
      ...orderFields,
      status: "pending_payment",
      paymentStatus: "unpaid",
      events: withEvent(retry, { at, type: "note", actor: data.userId ? { id: data.userId, role: "customer" } : SYSTEM, message: "payment_retry" }),
    });
    const existingPayment = retry.paymentId ? await db.payments.get(retry.paymentId) : null;
    const paymentPatch = { amount: chargedTotal, currency: ctx.currency, status: "requires_payment_method" as const, failureCode: undefined, updatedAt: at };
    payment = existingPayment
      ? await db.payments.update(existingPayment.id, paymentPatch)
      : await db.payments.insert({ orderId: order.id, provider: provider.id, providerRef: "", refunds: [], createdAt: at, ...paymentPatch });
    if (!existingPayment) order = await db.orders.update(order.id, { paymentId: payment.id });
  } else {
    const number = await allocateOrderNumber();
    await reserveStock(stockItems({ items }), number);
    const actor: Actor = data.userId ? { id: data.userId, email: data.email, role: "customer" } : SYSTEM;
    order = await db.orders.insert({
      number,
      status: "pending_payment",
      paymentStatus: "unpaid",
      ...orderFields,
      accessToken: createToken(32),
      idempotencyKey: data.idempotencyKey,
      events: [{ id: createId("evt"), at, type: "created", status: "pending_payment", message: "Order placed", actor }],
      internalNotes: [],
      createdAt: at,
    });
    payment = await db.payments.insert({
      orderId: order.id,
      provider: provider.id,
      providerRef: "",
      amount: chargedTotal,
      currency: ctx.currency,
      status: "requires_payment_method",
      refunds: [],
      createdAt: at,
      updatedAt: at,
    });
    order = await db.orders.update(order.id, { paymentId: payment.id });
  }
  // Reserve the coupon under the DB lock (limits enforced, not forced); released on failure/expiry/cancel.
  if (priced.couponCode) {
    await redeemCoupon(priced.couponCode, { orderId: order.id, userId: order.userId, email: order.email });
  }
  return { kind: "charge", order, payment, attempt, cartId: cart.id };
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const data = parsePlaceOrder(input);
  const settings = await getSettings();
  if (settings.maintenanceMode) throw new DomainError("maintenance", { status: 503 });
  if (!data.userId && !settings.checkout.guestCheckout) throw new DomainError("guest_checkout_disabled", { status: 403 });
  await releaseExpiredReservations().catch((error: unknown) => logger.warn("inventory.release_failed", { error }));

  // Phase 1 (one transaction under the DB lock): validate, price, reserve stock, create the pending order.
  const prepared = await db.transaction(() => prepareOrder(data));
  if (prepared.kind === "replay") return prepared.result;

  // Phase 2 (no lock held): talk to the payment provider.
  const provider = getPaymentProvider();
  let outcome: Awaited<ReturnType<typeof provider.charge>>;
  try {
    outcome = await provider.charge({
      amount: prepared.order.chargedTotal,
      currency: prepared.order.currency,
      payment: data.payment,
      idempotencyKey: `${prepared.order.idempotencyKey}:${prepared.attempt}`,
      metadata: { orderNumber: prepared.order.number, email: prepared.order.email },
    });
  } catch (error) {
    logger.error("payment.charge_error", { orderNumber: prepared.order.number, error });
    outcome = { status: "failed", code: "processing_error" };
  }

  // Phase 3: record the outcome.
  const at = nowIso();
  switch (outcome.status) {
    case "succeeded": {
      const settled = await settleCapturedPayment(prepared.order.id, { providerRef: outcome.providerRef, method: outcome.method });
      if (settled.status === "orphaned") return { status: "failed", order: settled.order, error: "payment_orphaned" };
      const order = settled.order;
      await afterPaid(order, { cartId: prepared.cartId, saveAddress: Boolean(data.saveAddress), newsletterOptIn: Boolean(data.newsletterOptIn) });
      return { status: "succeeded", order: (await db.orders.get(order.id)) ?? order };
    }
    case "requires_action": {
      await db.payments.update(prepared.payment.id, { status: "requires_action", providerRef: outcome.providerRef, method: outcome.method, updatedAt: at });
      // Newsletter consent is independent of the payment outcome.
      if (data.newsletterOptIn) await subscribe({ email: data.email, locale: data.locale, source: "checkout" }).catch(() => undefined);
      const order = (await db.orders.get(prepared.order.id)) as Order;
      return { status: "requires_action", order, actionToken: outcome.actionToken };
    }
    case "failed": {
      if (outcome.providerRef) await db.payments.update(prepared.payment.id, { providerRef: outcome.providerRef }).catch(() => undefined);
      const order = await markPaymentFailed(prepared.order.id, outcome.code);
      return { status: "failed", order, error: failureError(outcome.code) };
    }
  }
}

export async function completePaymentAction(input: { orderNumber: string; actionToken: string; approved: boolean; access: OrderAccess }): Promise<PlaceOrderResult> {
  const visible = await getOrderByNumber(input.orderNumber, input.access);
  if (!visible) throw new DomainError("order_not_found", { status: 404 });
  const order = (await db.orders.get(visible.id)) as Order;
  if (order.paymentStatus === "paid") return { status: "succeeded", order };
  const payment = order.paymentId ? await db.payments.get(order.paymentId) : null;
  if (order.status !== "pending_payment" || order.paymentStatus !== "unpaid" || !payment || payment.status !== "requires_action") throw new DomainError("conflict", { status: 409 });

  const provider = getPaymentProvider();
  let confirmed: Awaited<ReturnType<typeof provider.confirmAction>>;
  try {
    confirmed = await provider.confirmAction({ providerRef: payment.providerRef, actionToken: input.actionToken, approved: input.approved });
  } catch (error) {
    logger.error("payment.confirm_error", { orderNumber: order.number, error });
    confirmed = { status: "failed", code: "authentication_failed" };
  }
  if (confirmed.status === "succeeded") {
    const settled = await settleCapturedPayment(order.id, { providerRef: confirmed.providerRef, method: payment.method });
    if (settled.status === "orphaned") return { status: "failed", order: settled.order, error: "payment_orphaned" };
    const result = { order: settled.order };
    await afterPaid(result.order, { cartId: order.cartId, saveAddress: false, newsletterOptIn: false });
    return { status: "succeeded", order: (await db.orders.get(order.id)) ?? result.order };
  }
  const failed = await markPaymentFailed(order.id, confirmed.code);
  return { status: "failed", order: failed, error: failureError(confirmed.code) };
}

/**
 * Marks an order paid after the provider captured money. The charge runs without a lock, so the order may have been
 * cancelled/expired meanwhile: in that case the payment is orphaned, so we audit it and refund automatically.
 */
async function settleCapturedPayment(
  orderId: Id,
  info: { providerRef: string; method?: Payment["method"] },
): Promise<{ status: "paid"; order: Order } | { status: "orphaned"; order: Order }> {
  try {
    const { order } = await markOrderPaid(orderId, info);
    return { status: "paid", order };
  } catch (error) {
    const code = isDomainError(error) ? error.code : undefined;
    if (code !== "invalid_status_transition" && code !== "insufficient_stock" && code !== "out_of_stock") throw error;
    const order = (await db.orders.get(orderId)) as Order;
    let refundNote = "automatic refund failed; refund manually";
    try {
      const result = await getPaymentProvider().refund({
        providerRef: info.providerRef,
        amount: order.chargedTotal,
        currency: order.currency,
        reason: "Order no longer payable",
        idempotencyKey: `orphan:${order.id}:${info.providerRef}`,
      });
      refundNote = result.status === "succeeded" ? `refunded automatically (${result.refundRef})` : `automatic refund failed (${result.code}); refund manually`;
    } catch (refundError) {
      logger.error("payment.orphan_refund_error", { orderId, error: refundError });
    }
    await logAudit({ actor: SYSTEM, action: "payment.orphaned", entityType: "order", entityId: order.id, summary: `Payment ${info.providerRef} captured for ${order.status} order ${order.number} (${code}); ${refundNote}` });
    if (order.paymentId) await db.payments.update(order.paymentId, { providerRef: info.providerRef, updatedAt: nowIso() }).catch(() => undefined);
    return { status: "orphaned", order };
  }
}

/** Best-effort side effects after money is captured. None of them may fail the order. */
async function afterPaid(order: Order, opts: { cartId?: Id; saveAddress: boolean; newsletterOptIn: boolean }): Promise<void> {
  const settings = await getSettings();
  const safe = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (error) {
      logger.warn(`checkout.after_paid.${label}`, { orderId: order.id, error: isDomainError(error) ? error.code : error });
    }
  };

  if (opts.cartId) {
    await safe("clear_cart", async () => {
      const cart = await db.carts.get(opts.cartId as Id);
      if (cart) await db.carts.update(cart.id, { items: [], couponCode: undefined, updatedAt: nowIso() });
    });
  }
  if (opts.saveAddress && order.userId) {
    await safe("save_address", async () => {
      const userId = order.userId as Id;
      const a = order.shippingAddress;
      const known = (await listAddresses(userId)).some((x) => x.line1 === a.line1 && x.postalCode === a.postalCode && x.country === a.country && x.firstName === a.firstName && x.lastName === a.lastName);
      if (!known) await createAddress(userId, { ...a, label: a.label ?? "Checkout" });
    });
  }
  if (opts.newsletterOptIn) await safe("newsletter", () => subscribe({ email: order.email, locale: order.locale, source: "checkout" }));

  const sent: string[] = [];
  if (settings.emails.orderConfirmation) {
    await safe("confirmation_email", async () => {
      await sendOrderConfirmation(order);
      sent.push("order_confirmation");
    });
  }
  if (settings.emails.adminNewOrder && settings.emails.adminAddress) {
    await safe("admin_email", () => sendAdminNewOrder(order, settings.emails.adminAddress));
  }
  if (sent.length) {
    await safe("email_event", async () => {
      const fresh = await db.orders.get(order.id);
      if (fresh) await db.orders.update(order.id, { events: withEvent(fresh, { type: "email_sent", actor: SYSTEM, message: sent[0] }) });
    });
  }
}

/* ------------------------------------------------------------------ provider webhooks */

/**
 * Reconciles an asynchronous provider event (late 3-D-Secure completion, delayed failure). Idempotent: events for
 * orders already in the target state are ignored. Returns what happened for logging/tests.
 */
export async function applyPaymentEvent(event: PaymentWebhookEvent): Promise<"applied" | "ignored" | "needs_review"> {
  const payment = await db.payments.findOne((p) => p.providerRef === event.providerRef);
  if (!payment) return "ignored";
  const order = await db.orders.get(payment.orderId);
  if (!order) return "ignored";

  if (event.type === "payment.succeeded") {
    if (order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded" || order.paymentStatus === "refunded") return "ignored";
    if (order.status !== "pending_payment") {
      // Money arrived for an order that was already cancelled/expired: flag for manual refund.
      await logAudit({ actor: SYSTEM, action: "payment.orphaned", entityType: "order", entityId: order.id, summary: `Payment ${event.providerRef} succeeded for ${order.status} order ${order.number}; refund manually` });
      logger.error("payment.orphaned", { orderId: order.id, providerRef: event.providerRef });
      return "needs_review";
    }
    try {
      const result = await markOrderPaid(order.id, { providerRef: event.providerRef, method: payment.method, message: "Confirmed by provider webhook" });
      await afterPaid(result.order, { cartId: order.cartId, saveAddress: false, newsletterOptIn: false });
      return "applied";
    } catch (error) {
      if (isDomainError(error) && (error.code === "insufficient_stock" || error.code === "out_of_stock")) {
        await logAudit({ actor: SYSTEM, action: "payment.orphaned", entityType: "order", entityId: order.id, summary: `Payment ${event.providerRef} succeeded but stock is gone for ${order.number}; refund or restock` });
        return "needs_review";
      }
      throw error;
    }
  }
  if (event.type === "payment.failed") {
    if (order.paymentStatus !== "unpaid") return "ignored";
    await markPaymentFailed(order.id, event.code ?? "card_declined");
    return "applied";
  }
  return "ignored"; // refund.succeeded: refunds are recorded synchronously when staff issue them
}

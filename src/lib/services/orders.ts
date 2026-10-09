import "server-only";
import { z } from "zod";
import { zodFieldErrors } from "@/lib/action-result";
import { createId, db } from "@/lib/db";
import { DomainError, notFound } from "@/lib/errors";
import { sendRefundNotice, sendShippingUpdate } from "@/lib/email";
import { logger } from "@/lib/logger";
import { canTransition, isRefundable, wasPaid } from "@/lib/order-status";
import { getPaymentProvider } from "@/lib/payments";
import { minorToMajorString } from "@/lib/money";
import type { Actor, Id, Order, OrderStatus, Paged, PageParams, Payment, Refund, User } from "@/lib/types/domain";
import type { OrderAccess, OrderFilter, RefundInput } from "./contracts";
import { logAudit } from "./audit";
import { toCsv } from "./_csv";
import { actorLabel, includesText, nowIso, paginate, safeEqual } from "./_shared";
import { markOrderPaid, stockItems, withEvent } from "./_order-lifecycle";
import { releaseCouponRedemption } from "./coupons";
import { releaseExpiredReservations, releaseStock, restockItems } from "./inventory";
import { getSettings } from "./settings";

/* ------------------------------------------------------------------ access + redaction */

function sameNumber(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Customers never see internal notes or staff identities. */
export function redactForCustomer(order: Order): Order {
  return {
    ...order,
    internalNotes: [],
    events: order.events.map((e) => ({
      ...e,
      actor: e.actor.role === "customer" || e.actor.role === "system" ? { id: e.actor.id, role: e.actor.role } : { id: "staff", role: "system" as const },
    })),
  };
}

async function permitted(order: Order, access: OrderAccess): Promise<boolean> {
  if ("staff" in access) return access.staff === true;
  if ("userId" in access) return order.userId !== null && order.userId === access.userId;
  return typeof access.accessToken === "string" && access.accessToken.length > 0 && (await safeEqual(order.accessToken, access.accessToken));
}

export async function getOrderByNumber(number: string, access: OrderAccess): Promise<Order | null> {
  const order = await db.orders.findOne((o) => sameNumber(o.number, number));
  if (!order || !(await permitted(order, access))) return null;
  return "staff" in access ? order : redactForCustomer(order);
}

export async function listOrdersForUser(userId: Id, params?: PageParams): Promise<Paged<Order>> {
  const rows = await db.orders.find({
    where: (o) => o.userId === userId && !(o.status === "pending_payment" && o.paymentStatus === "failed"),
    orderBy: [{ field: "createdAt", direction: "desc" }],
  });
  const page = paginate(rows, params, 10);
  return { ...page, items: page.items.map(redactForCustomer) };
}

export async function trackOrder(input: { number: string; email: string }): Promise<Order | null> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.number.trim()) return null;
  const order = await db.orders.findOne((o) => sameNumber(o.number, input.number) && o.email.toLowerCase() === email);
  return order ? redactForCustomer(order) : null;
}

export async function hasUserPurchased(userId: Id, productId: Id): Promise<boolean> {
  const hit = await db.orders.findOne((o) => o.userId === userId && wasPaid(o.paymentStatus) && o.status !== "cancelled" && o.items.some((i) => i.productId === productId));
  return Boolean(hit);
}

/* ------------------------------------------------------------------ refunds + cancellation (shared core) */

interface RefundPlan {
  amount: number;
  /** quantities returned per order item */
  itemQuantities: Map<Id, number>;
  includesShipping: boolean;
  isFull: boolean;
}

function planRefund(order: Order, payment: Payment | null, input: Pick<RefundInput, "amount" | "items" | "includeShipping">): RefundPlan {
  const remaining = order.total - order.refundedTotal;
  if (remaining <= 0) throw new DomainError("refund_exceeds_paid", { status: 409 });
  const previouslyRefundedShipping = payment?.refunds.some((r) => r.includesShipping) ?? false;
  const itemQuantities = new Map<Id, number>();
  let amount = 0;
  let includesShipping = false;

  if (input.items && input.items.length > 0) {
    for (const wanted of input.items) {
      const item = order.items.find((i) => i.id === wanted.orderItemId);
      if (!item) throw notFound("order item");
      const available = item.quantity - item.refundedQuantity - (itemQuantities.get(item.id) ?? 0);
      if (!Number.isInteger(wanted.quantity) || wanted.quantity < 1 || wanted.quantity > available) throw new DomainError("quantity_invalid", { status: 400, params: { max: available } });
      const gross = item.lineTotal + item.tax;
      const from = item.refundedQuantity + (itemQuantities.get(item.id) ?? 0);
      const to = from + wanted.quantity;
      amount += Math.round((gross * to) / item.quantity) - Math.round((gross * from) / item.quantity);
      itemQuantities.set(item.id, (itemQuantities.get(item.id) ?? 0) + wanted.quantity);
    }
    if (input.includeShipping && !previouslyRefundedShipping) {
      amount += order.shipping;
      includesShipping = order.shipping > 0;
    }
  } else if (input.amount !== undefined) {
    if (!Number.isInteger(input.amount) || input.amount <= 0) throw new DomainError("validation_failed", { fieldErrors: { amount: ["must_be_positive"] } });
    amount = input.amount;
  } else {
    amount = remaining; // full refund of what is left
  }

  if (amount <= 0) throw new DomainError("validation_failed", { fieldErrors: { amount: ["must_be_positive"] } });
  if (amount > remaining) throw new DomainError("refund_exceeds_paid", { status: 409 });
  const isFull = amount === remaining;
  if (isFull) {
    // everything left goes back
    for (const item of order.items) {
      const left = item.quantity - item.refundedQuantity - (itemQuantities.get(item.id) ?? 0);
      if (left > 0) itemQuantities.set(item.id, (itemQuantities.get(item.id) ?? 0) + left);
    }
  }
  return { amount, itemQuantities, includesShipping, isFull };
}

interface RefundRequest {
  orderId: Id;
  input: Pick<RefundInput, "amount" | "items" | "includeShipping" | "reason" | "restock">;
  actor: Actor;
  /** Cancelling: whole remaining amount, order ends `cancelled`. */
  mode: "refund" | "cancel";
}

/**
 * One refund/cancellation: plan -> provider call (outside the lock) -> atomic apply (order, payment, stock, coupon).
 * Returns the updated order and the refunded USD amount (0 for unpaid cancellations).
 */
async function executeRefund(req: RefundRequest): Promise<{ order: Order; refunded: number }> {
  // Serialize refunds per order so concurrent attempts (double click, two admin tabs) plan against
  // the already-recorded refunds instead of racing each other at the provider.
  const previous = refundLocks.get(req.orderId) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(() => executeRefundUnlocked(req));
  const tail = run.then(() => undefined, () => undefined);
  refundLocks.set(req.orderId, tail);
  try {
    return await run;
  } finally {
    if (refundLocks.get(req.orderId) === tail) refundLocks.delete(req.orderId);
  }
}

const refundLocks = new Map<Id, Promise<void>>();

async function executeRefundUnlocked(req: RefundRequest): Promise<{ order: Order; refunded: number }> {
  const snapshot = await db.orders.get(req.orderId);
  if (!snapshot) throw notFound("order");
  const payment = snapshot.paymentId ? await db.payments.get(snapshot.paymentId) : null;
  const paid = isRefundable(snapshot.paymentStatus);

  if (req.mode === "cancel") {
    if (snapshot.status !== "pending_payment" && snapshot.status !== "processing") throw new DomainError("order_not_cancellable", { status: 409 });
  } else if (!paid || (snapshot.status !== "processing" && snapshot.status !== "shipped" && snapshot.status !== "delivered")) {
    throw new DomainError("invalid_status_transition", { status: 409 });
  }

  let refund: Refund | null = null;
  // Cancelling a paid order refunds everything that is left; refunds follow the caller's amount/items.
  const plan: RefundPlan | null = paid ? planRefund(snapshot, payment, req.mode === "cancel" ? {} : req.input) : null;

  if (plan && plan.amount > 0) {
    if (!payment) throw new DomainError("refund_failed", { status: 409 });
    const previouslyCharged = payment.refunds.reduce((s, r) => s + r.amountCharged, 0);
    const amountCharged = plan.isFull ? Math.max(0, snapshot.chargedTotal - previouslyCharged) : Math.round(plan.amount * snapshot.fxRate);
    const provider = getPaymentProvider();
    const result = await provider
      .refund({ providerRef: payment.providerRef, amount: amountCharged, currency: snapshot.currency, reason: req.input.reason.slice(0, 200), idempotencyKey: `refund:${snapshot.id}:${payment.refunds.length + 1}:${plan.amount}` })
      .catch((error: unknown) => {
        logger.error("payment.refund_error", { orderId: snapshot.id, error });
        return { status: "failed" as const, code: "provider_error" };
      });
    if (result.status !== "succeeded") throw new DomainError("refund_failed", { status: 502, params: { code: result.code } });
    refund = {
      id: createId("ref"),
      at: nowIso(),
      amount: plan.amount,
      amountCharged,
      reason: req.input.reason.slice(0, 200),
      providerRef: result.refundRef,
      ...(req.input.items?.length ? { items: req.input.items.map((i) => ({ orderItemId: i.orderItemId, quantity: i.quantity })) } : {}),
      ...(plan.includesShipping ? { includesShipping: true } : {}),
      restock: req.input.restock,
      actor: req.actor,
    };
  }

  const updated = await db.transaction(async () => {
    const order = await db.orders.get(req.orderId);
    if (!order) throw notFound("order");
    const changed = order.updatedAt !== snapshot.updatedAt || order.status !== snapshot.status;
    if (changed && !refund) throw new DomainError("conflict", { status: 409 });
    // When the provider already moved the money the refund MUST be recorded, so a concurrent
    // change (shipment update, note, ...) does not abort the apply step; it is applied to the fresh order.
    if (changed) logger.warn("order.refund_concurrent_change", { orderId: order.id, refundRef: refund?.providerRef });
    const at = nowIso();
    let events = order.events;
    const items = order.items.map((i) => ({ ...i }));
    let refundedTotal = order.refundedTotal;
    let paymentStatus = order.paymentStatus;
    let status: OrderStatus = order.status;

    if (plan && refund) {
      refundedTotal += plan.amount;
      const applied = new Map<Id, number>();
      for (const item of items) {
        const qty = Math.min(plan.itemQuantities.get(item.id) ?? 0, Math.max(0, item.quantity - item.refundedQuantity));
        item.refundedQuantity += qty;
        applied.set(item.id, qty);
      }
      paymentStatus = refundedTotal >= order.total ? "refunded" : "partially_refunded";
      if (payment) {
        const freshPayment = (await db.payments.get(payment.id)) ?? payment;
        await db.payments.update(payment.id, { refunds: [...freshPayment.refunds, refund], updatedAt: at });
      }

      // units that came back
      const returned = items.map((i) => ({ item: i, qty: applied.get(i.id) ?? 0 })).filter((r) => r.qty > 0);
      if (req.input.restock && returned.length) await restockItems(returned.map((r) => ({ variantId: r.item.variantId, quantity: r.qty })), order.number, req.actor);
      for (const r of returned) {
        const product = await db.products.get(r.item.productId);
        if (product) await db.products.update(product.id, { soldCount: Math.max(0, product.soldCount - r.qty) });
      }
      events = withEvent({ events }, {
        at,
        type: "refund",
        actor: req.actor,
        message: `${minorToMajorString(plan.amount)} USD: ${req.input.reason}`.slice(0, 300),
      });
    } else if (!paid && order.paymentStatus === "unpaid") {
      // unpaid order: it only holds a reservation
      await releaseStock(stockItems(order), order.number);
    }

    if (order.status === "cancelled" || order.status === "refunded") status = order.status;
    else if (req.mode === "cancel") status = "cancelled";
    else if (paymentStatus === "refunded" && plan?.isFull) status = order.status === "processing" ? "cancelled" : "refunded"; // refunding everything before shipping is a cancellation

    if (status === "cancelled" && order.status !== "cancelled") {
      events = withEvent({ events }, { at, type: "cancelled", status: "cancelled", actor: req.actor, message: req.input.reason.slice(0, 300) });
      await releaseCouponRedemption(order.id);
    } else if (status === "refunded" && order.status !== "refunded") {
      events = withEvent({ events }, { at, type: "status_changed", status: "refunded", actor: req.actor });
    }
    return db.orders.update(order.id, { status, paymentStatus, refundedTotal, items, events, updatedAt: at });
  });

  if (refund) {
    await sendRefundNotice(updated, refund.amount).catch((error: unknown) => logger.warn("email.refund_failed", { orderId: updated.id, error }));
  }
  return { order: updated, refunded: refund?.amount ?? 0 };
}

/* ------------------------------------------------------------------ customer self-service */

export async function cancelOwnOrder(input: { number: string; userId: Id; reason?: string }): Promise<Order> {
  const order = await db.orders.findOne((o) => sameNumber(o.number, input.number));
  if (!order || order.userId !== input.userId) throw new DomainError("order_not_found", { status: 404 });
  if (order.status !== "pending_payment" && order.status !== "processing") throw new DomainError("order_not_cancellable", { status: 409 });
  // A payment attempt may be in flight (the provider charge runs without a lock): same 60s rule prepareOrder uses.
  if (order.status === "pending_payment" && order.paymentStatus === "unpaid" && Date.now() - Date.parse(order.updatedAt) < 60_000) {
    throw new DomainError("order_not_cancellable", { status: 409 });
  }
  const user = await db.users.get(input.userId);
  const actor: Actor = { id: input.userId, email: user?.email, role: "customer" };
  const { order: updated } = await executeRefund({ orderId: order.id, mode: "cancel", actor, input: { reason: input.reason?.trim() || "Cancelled by customer", restock: true } });
  await logAudit({ actor, action: "order.cancel", entityType: "order", entityId: order.id, summary: `Customer cancelled ${order.number}` });
  return redactForCustomer(updated);
}

/* ------------------------------------------------------------------ admin */

export async function adminListOrders(filter: OrderFilter): Promise<Paged<Order>> {
  await releaseExpiredReservations().catch((error: unknown) => logger.warn("inventory.release_failed", { error }));
  const from = filter.from ? Date.parse(filter.from) : undefined;
  const to = filter.to ? Date.parse(filter.to) : undefined;
  const rows = await db.orders.find({ where: (o) => matchesFilter(o, filter, from, to) });
  const dir = filter.sort === "created_asc" || filter.sort === "total_asc" ? 1 : -1;
  const byTotal = filter.sort === "total_asc" || filter.sort === "total_desc";
  rows.sort((a, b) => dir * (byTotal ? a.total - b.total : a.createdAt.localeCompare(b.createdAt)) || b.createdAt.localeCompare(a.createdAt));
  return paginate(rows, filter, 25);
}

function matchesFilter(o: Order, f: Omit<OrderFilter, "page" | "pageSize">, from?: number, to?: number): boolean {
  if (f.status && f.status !== "all" && o.status !== f.status) return false;
  if (f.paymentStatus && f.paymentStatus !== "all" && o.paymentStatus !== f.paymentStatus) return false;
  if (f.userId && o.userId !== f.userId) return false;
  if (from !== undefined || to !== undefined) {
    const t = Date.parse(o.createdAt);
    if (from !== undefined && t < from) return false;
    if (to !== undefined && t > to) return false;
  }
  if (f.q && !includesText([o.number, o.email, `${o.shippingAddress.firstName} ${o.shippingAddress.lastName}`, o.trackingNumber], f.q)) return false;
  return true;
}

export async function adminGetOrder(id: Id): Promise<{ order: Order; payment?: Payment; customer?: User | null } | null> {
  const order = await db.orders.get(id);
  if (!order) return null;
  const [payment, customer] = await Promise.all([order.paymentId ? db.payments.get(order.paymentId) : Promise.resolve(null), order.userId ? db.users.get(order.userId) : Promise.resolve(null)]);
  return { order, ...(payment ? { payment } : {}), customer: customer ?? null };
}

async function requireOrder(id: Id): Promise<Order> {
  const order = await db.orders.get(id);
  if (!order) throw new DomainError("order_not_found", { status: 404 });
  return order;
}

export async function updateOrderStatus(id: Id, status: OrderStatus, actor: Actor, note?: string): Promise<Order> {
  const order = await requireOrder(id);
  if (order.status === status || !canTransition(order.status, status)) {
    throw new DomainError("invalid_status_transition", { status: 409, params: { from: order.status, to: status } });
  }
  const reason = note?.trim() || (status === "cancelled" ? "Cancelled by staff" : status === "refunded" ? "Refunded by staff" : "");
  switch (status) {
    case "cancelled":
      return cancelOrder(id, { reason, restock: true, refund: isRefundable(order.paymentStatus) }, actor);
    case "refunded":
      return refundOrder(id, { reason, restock: true, includeShipping: true }, actor);
    case "shipped":
      return applyShipment(id, {}, actor, note);
    case "delivered":
      return markDelivered(id, actor);
    case "processing":
      return applyManualPayment(id, actor, note);
    default:
      throw new DomainError("invalid_status_transition", { status: 409 });
  }
}

async function applyManualPayment(id: Id, actor: Actor, note?: string): Promise<Order> {
  const result = await db.transaction(async () => {
    const order = await requireOrder(id);
    const payment = order.paymentId ? await db.payments.get(order.paymentId) : null;
    const { order: paid } = await markOrderPaid(id, { providerRef: payment?.providerRef || `manual_${order.number}`, actor, message: note?.trim() || "Marked as paid by staff" });
    await logAudit({ actor, action: "order.status_change", entityType: "order", entityId: id, summary: `${order.number}: pending_payment -> processing (manual payment)`, changes: { status: { from: order.status, to: "processing" } } });
    return paid;
  });
  return result;
}

const shipmentSchema = z.object({
  carrier: z.string().trim().max(60, "too_long"),
  trackingNumber: z.string().trim().max(80, "too_long"),
});

async function applyShipment(id: Id, input: { carrier?: string; trackingNumber?: string; notifyCustomer?: boolean }, actor: Actor, note?: string): Promise<Order> {
  const updated = await db.transaction(async () => {
    const order = await requireOrder(id);
    const isAmend = order.status === "shipped";
    if (!isAmend && order.status !== "processing") throw new DomainError("invalid_status_transition", { status: 409, params: { from: order.status, to: "shipped" } });
    if (order.paymentStatus !== "paid" && order.paymentStatus !== "partially_refunded") throw new DomainError("invalid_status_transition", { status: 409 });
    const at = nowIso();
    const parsed = shipmentSchema.safeParse({ carrier: input.carrier ?? order.carrier ?? "", trackingNumber: input.trackingNumber ?? order.trackingNumber ?? "" });
    if (!parsed.success) throw new DomainError("validation_failed", { fieldErrors: zodFieldErrors(parsed.error) });
    const { carrier, trackingNumber } = parsed.data;
    const label = [carrier, trackingNumber].filter(Boolean).join(" ") || (order.shippingMethod.code === "pickup" ? "Ready for pickup" : "");
    const events = withEvent(order, { at, type: "shipped", status: "shipped", actor, message: (isAmend ? `Tracking updated: ${label}` : note?.trim() || label).slice(0, 300) });
    const saved = await db.orders.update(id, {
      status: "shipped",
      ...(carrier ? { carrier } : {}),
      ...(trackingNumber ? { trackingNumber } : {}),
      shippedAt: order.shippedAt ?? at,
      events,
      updatedAt: at,
    });
    await logAudit({ actor, action: isAmend ? "order.tracking_update" : "order.status_change", entityType: "order", entityId: id, summary: `${order.number}: ${isAmend ? "tracking updated" : "processing -> shipped"}`, changes: isAmend ? undefined : { status: { from: order.status, to: "shipped" } } });
    return saved;
  });

  const settings = await getSettings();
  if (input.notifyCustomer !== false && settings.emails.shippingUpdate) {
    try {
      await sendShippingUpdate(updated);
      return db.orders.update(id, { events: withEvent(updated, { type: "email_sent", actor: { id: "system", role: "system" }, message: "shipping_update" }) });
    } catch (error) {
      logger.warn("email.shipping_failed", { orderId: id, error });
    }
  }
  return updated;
}

export async function markShipped(id: Id, input: { carrier: string; trackingNumber: string; notifyCustomer?: boolean }, actor: Actor): Promise<Order> {
  const order = await requireOrder(id);
  if (order.shippingMethod.code !== "pickup" && (!input.carrier?.trim() || !input.trackingNumber?.trim())) {
    throw new DomainError("validation_failed", { fieldErrors: { ...(!input.carrier?.trim() ? { carrier: ["required"] } : {}), ...(!input.trackingNumber?.trim() ? { trackingNumber: ["required"] } : {}) } });
  }
  return applyShipment(id, input, actor);
}

export async function markDelivered(id: Id, actor: Actor): Promise<Order> {
  return db.transaction(async () => {
    const order = await requireOrder(id);
    if (order.status !== "shipped") throw new DomainError("invalid_status_transition", { status: 409, params: { from: order.status, to: "delivered" } });
    const at = nowIso();
    const saved = await db.orders.update(id, { status: "delivered", deliveredAt: at, events: withEvent(order, { at, type: "status_changed", status: "delivered", actor }), updatedAt: at });
    await logAudit({ actor, action: "order.status_change", entityType: "order", entityId: id, summary: `${order.number}: shipped -> delivered`, changes: { status: { from: "shipped", to: "delivered" } } });
    return saved;
  });
}

export async function cancelOrder(id: Id, input: { reason: string; restock: boolean; refund: boolean }, actor: Actor): Promise<Order> {
  const reason = input.reason?.trim();
  if (!reason) throw new DomainError("validation_failed", { fieldErrors: { reason: ["required"] } });
  const before = await requireOrder(id);
  if (before.status !== "pending_payment" && before.status !== "processing") throw new DomainError("order_not_cancellable", { status: 409 });

  if (!input.refund && isRefundable(before.paymentStatus)) {
    // Cancel without refunding (e.g. refunded out of band): stock handling only.
    const updated = await db.transaction(async () => {
      const order = await requireOrder(id);
      const at = nowIso();
      if (input.restock) {
        const remaining = order.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity - i.refundedQuantity })).filter((i) => i.quantity > 0);
        if (remaining.length) await restockItems(remaining, order.number, actor);
      }
      for (const item of order.items) {
        const product = await db.products.get(item.productId);
        if (product) await db.products.update(product.id, { soldCount: Math.max(0, product.soldCount - (item.quantity - item.refundedQuantity)) });
      }
      await releaseCouponRedemption(order.id);
      const events = withEvent(order, { at, type: "cancelled", status: "cancelled", actor, message: `${reason} (no refund issued)`.slice(0, 300) });
      return db.orders.update(id, { status: "cancelled", events, updatedAt: at });
    });
    await logAudit({ actor, action: "order.cancel", entityType: "order", entityId: id, summary: `Cancelled ${before.number} without refund`, changes: { status: { from: before.status, to: "cancelled" } } });
    return updated;
  }

  const { order, refunded } = await executeRefund({ orderId: id, mode: "cancel", actor, input: { reason, restock: input.restock } });
  await logAudit({ actor, action: "order.cancel", entityType: "order", entityId: id, summary: `Cancelled ${before.number}${refunded ? ` and refunded ${minorToMajorString(refunded)} USD` : ""}`, changes: { status: { from: before.status, to: "cancelled" } } });
  return order;
}

export async function refundOrder(id: Id, input: RefundInput, actor: Actor): Promise<Order> {
  const reason = input.reason?.trim();
  if (!reason) throw new DomainError("validation_failed", { fieldErrors: { reason: ["required"] } });
  const before = await requireOrder(id);
  // A complete refund before shipping is a cancellation.
  const { order, refunded } = await executeRefund({ orderId: id, mode: "refund", actor, input: { ...input, reason } });
  await logAudit({
    actor,
    action: "order.refund",
    entityType: "order",
    entityId: id,
    summary: `Refunded ${minorToMajorString(refunded)} USD on ${before.number}`,
    changes: { refundedTotal: { from: before.refundedTotal, to: order.refundedTotal }, paymentStatus: { from: before.paymentStatus, to: order.paymentStatus } },
  });
  return order;
}

export async function addOrderNote(id: Id, body: string, actor: Actor): Promise<Order> {
  const text = body?.trim();
  if (!text || text.length > 2000) throw new DomainError("validation_failed", { fieldErrors: { body: [text ? "too_long" : "required"] } });
  return db.transaction(async () => {
    const order = await requireOrder(id);
    const note = { id: createId("note"), at: nowIso(), by: actorLabel(actor), body: text };
    const saved = await db.orders.update(id, { internalNotes: [...order.internalNotes, note] });
    await logAudit({ actor, action: "order.note", entityType: "order", entityId: id, summary: `Note added to ${order.number}` });
    return saved;
  });
}

const CSV_HEADER = ["number", "created_at", "status", "payment_status", "email", "customer", "country", "items", "units", "subtotal_usd", "discount_usd", "shipping_usd", "tax_usd", "total_usd", "refunded_usd", "currency", "charged", "coupon", "shipping_method", "carrier", "tracking"];

export async function exportOrdersCsv(filter: Omit<OrderFilter, "page" | "pageSize">): Promise<string> {
  const from = filter.from ? Date.parse(filter.from) : undefined;
  const to = filter.to ? Date.parse(filter.to) : undefined;
  const rows = await db.orders.find({ where: (o) => matchesFilter(o, filter, from, to), orderBy: [{ field: "createdAt", direction: "desc" }] });
  return toCsv(
    CSV_HEADER,
    rows.map((o) => [
      o.number,
      o.createdAt,
      o.status,
      o.paymentStatus,
      o.email,
      `${o.shippingAddress.firstName} ${o.shippingAddress.lastName}`,
      o.shippingAddress.country,
      o.items.length,
      o.items.reduce((s, i) => s + i.quantity, 0),
      minorToMajorString(o.subtotal),
      minorToMajorString(o.discount),
      minorToMajorString(o.shipping),
      minorToMajorString(o.tax),
      minorToMajorString(o.total),
      minorToMajorString(o.refundedTotal),
      o.currency,
      minorToMajorString(o.chargedTotal),
      o.couponCode ?? "",
      o.shippingMethod.code,
      o.carrier ?? "",
      o.trackingNumber ?? "",
    ]),
    new Set([7, 8, 9, 10, 11, 12, 13, 14, 16]),
  );
}


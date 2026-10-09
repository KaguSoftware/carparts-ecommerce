import "server-only";
import { createId, db } from "@/lib/db";
import { DomainError, notFound } from "@/lib/errors";
import type { Actor, Id, Order, OrderEvent, Payment } from "@/lib/types/domain";
import { nowIso } from "./_shared";
import { redeemCoupon, releaseCouponRedemption } from "./coupons";
import { commitStock, releaseStock, reserveStock } from "./inventory";

/** State transitions shared by checkout (payment outcome) and orders (admin actions). Run inside a transaction. */

const SYSTEM: Actor = { id: "system", role: "system" };

export function withEvent(order: Pick<Order, "events">, event: Omit<OrderEvent, "id" | "at"> & { at?: string }): OrderEvent[] {
  return [...order.events, { id: createId("evt"), at: event.at ?? nowIso(), ...event }];
}

const stockItems = (order: Pick<Order, "items">) => order.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity }));

/**
 * Payment captured: reserved stock becomes sold, coupon redeemed, order -> processing/paid.
 * Idempotent (already paid orders are returned untouched).
 */
export async function markOrderPaid(
  orderId: Id,
  info: { providerRef: string; method?: Payment["method"]; actor?: Actor; message?: string },
): Promise<{ order: Order; payment: Payment | null; changed: boolean }> {
  return db.transaction(async () => {
    const order = await db.orders.get(orderId);
    if (!order) throw notFound("order");
    const payment = order.paymentId ? await db.payments.get(order.paymentId) : null;
    if (order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded" || order.paymentStatus === "refunded") return { order, payment, changed: false };
    if (order.status !== "pending_payment") throw new DomainError("invalid_status_transition", { status: 409 });

    // A failed/expired attempt released its hold: take it again before selling.
    if (order.paymentStatus === "failed") await reserveStock(stockItems(order), order.number);
    await commitStock(stockItems(order), order.number);

    for (const item of order.items) {
      const product = await db.products.get(item.productId);
      if (product) await db.products.update(product.id, { soldCount: product.soldCount + item.quantity });
    }
    // Normally already reserved at order creation (idempotent per order). If the hold was released (failed/expired
    // attempt) and the limit has since been hit, the customer is already charged: record it and flag for review.
    let couponOverLimit = false;
    if (order.couponCode) {
      const who = { orderId: order.id, userId: order.userId, email: order.email };
      try {
        await redeemCoupon(order.couponCode, who);
      } catch (error) {
        if (!(error instanceof DomainError) || error.code !== "coupon_used_up") throw error;
        couponOverLimit = true;
        await redeemCoupon(order.couponCode, who, { force: true });
      }
    }

    const at = nowIso();
    const actor = info.actor ?? SYSTEM;
    let events = withEvent(order, { at, type: "paid", actor, message: info.message ?? (info.method ? `${info.method.brand.toUpperCase()} ****${info.method.last4}` : undefined) });
    if (couponOverLimit) events = withEvent({ events }, { at, type: "note", actor: SYSTEM, message: "coupon_limit_exceeded: review" });
    events = withEvent({ events }, { at, type: "status_changed", status: "processing", actor });
    const updated = await db.orders.update(order.id, { status: "processing", paymentStatus: "paid", events, updatedAt: at });

    let savedPayment: Payment | null = payment;
    if (payment) {
      savedPayment = await db.payments.update(payment.id, {
        status: "succeeded",
        providerRef: info.providerRef,
        ...(info.method ? { method: info.method } : {}),
        failureCode: undefined,
        updatedAt: at,
      });
    }
    return { order: updated, payment: savedPayment, changed: true };
  });
}

/** Payment declined / failed: hold released, order stays pending_payment with paymentStatus failed (customer may retry). */
export async function markPaymentFailed(orderId: Id, code: string): Promise<Order> {
  return db.transaction(async () => {
    const order = await db.orders.get(orderId);
    if (!order) throw notFound("order");
    if (order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded" || order.paymentStatus === "refunded") return order;
    if (order.paymentStatus === "unpaid") await releaseStock(stockItems(order), order.number);
    const at = nowIso();
    const updated = await db.orders.update(order.id, {
      paymentStatus: "failed",
      events: withEvent(order, { at, type: "payment_failed", actor: SYSTEM, message: code }),
      updatedAt: at,
    });
    if (order.paymentId) await db.payments.update(order.paymentId, { status: "failed", failureCode: code, updatedAt: at });
    await releaseCouponRedemption(order.id);
    return updated;
  });
}

export { stockItems };

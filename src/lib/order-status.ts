import type { OrderStatus, PaymentStatus } from "@/lib/types/domain";

/**
 * Order status graph (ARCHITECTURE.md > Orders). Pure and importable from anywhere (admin UI uses it to offer
 * only legal next steps; services enforce it).
 *
 *   pending_payment -> processing | cancelled
 *   processing      -> shipped | cancelled
 *   shipped         -> delivered
 *   delivered       -> refunded            (full refund)
 *   cancelled, refunded are terminal
 */
export const ORDER_STATUSES: readonly OrderStatus[] = ["pending_payment", "processing", "shipped", "delivered", "cancelled", "refunded"];

export const ORDER_STATUS_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pending_payment: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: OrderStatus): readonly OrderStatus[] {
  return ORDER_STATUS_TRANSITIONS[from];
}

export function isTerminal(status: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[status].length === 0;
}

export const PAYMENT_STATUSES: readonly PaymentStatus[] = ["unpaid", "paid", "failed", "partially_refunded", "refunded"];

/** Money was captured at some point (even if refunded since). */
export function wasPaid(paymentStatus: PaymentStatus): boolean {
  return paymentStatus === "paid" || paymentStatus === "partially_refunded" || paymentStatus === "refunded";
}

/** Money is still held (refundable). */
export function isRefundable(paymentStatus: PaymentStatus): boolean {
  return paymentStatus === "paid" || paymentStatus === "partially_refunded";
}

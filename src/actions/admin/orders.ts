"use server";

import { DomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { addOrderNote, cancelOrder, markDelivered, markShipped, refundOrder, updateOrderStatus } from "@/lib/services/orders";
import type { RefundInput } from "@/lib/services/contracts";
import { adminAction, refresh } from "./_shared";
import { cancelOrderSchema, deliverOrderSchema, orderNoteSchema, refundOrderSchema, shipOrderSchema, updateStatusSchema } from "./orders.schema";

const paths = (id: string) => ["/admin/orders", `/admin/orders/${id}`, "/admin", "/admin/inventory"];

export async function updateOrderStatusAction(raw: unknown) {
  return adminAction("orders.write", updateStatusSchema, raw, async ({ id, status, note }, { actor, user }) => {
    // cancelling/refunding through the status dropdown moves money, so it needs the refund permission
    if ((status === "cancelled" || status === "refunded") && !can(user.role, "orders.refund")) throw new DomainError("forbidden", { status: 403 });
    const order = await updateOrderStatus(id, status, actor, note || undefined);
    refresh(paths(id));
    return { status: order.status };
  });
}

export async function shipOrderAction(raw: unknown) {
  return adminAction("orders.write", shipOrderSchema, raw, async ({ id, carrier, trackingNumber, notifyCustomer }, { actor }) => {
    await markShipped(id, { carrier, trackingNumber, notifyCustomer }, actor);
    refresh(paths(id));
  });
}

export async function deliverOrderAction(raw: unknown) {
  return adminAction("orders.write", deliverOrderSchema, raw, async ({ id }, { actor }) => {
    await markDelivered(id, actor);
    refresh(paths(id));
  });
}

export async function cancelOrderAction(raw: unknown) {
  return adminAction("orders.write", cancelOrderSchema, raw, async ({ id, reason, restock, refund }, { actor, user }) => {
    if (refund && !can(user.role, "orders.refund")) throw new DomainError("forbidden", { status: 403 });
    await cancelOrder(id, { reason, restock, refund }, actor);
    refresh(paths(id), { store: true });
  });
}

/** Refund through the payment provider first, then apply to the order (service does both). Admin only. */
export async function refundOrderAction(raw: unknown) {
  return adminAction("orders.refund", refundOrderSchema, raw, async ({ id, mode, items, includeShipping, amount, reason, restock }, { actor }) => {
    let input: RefundInput;
    if (mode === "amount") {
      if (!amount) throw new DomainError("validation_failed", { fieldErrors: { amount: ["required"] } });
      input = { amount, reason, restock };
    } else if (mode === "items") {
      const lines = items.filter((i) => i.quantity > 0);
      if (lines.length === 0) throw new DomainError("validation_failed", { fieldErrors: { items: ["required"] } });
      input = { items: lines, includeShipping, reason, restock };
    } else {
      input = { reason, restock, includeShipping: true };
    }
    const order = await refundOrder(id, input, actor);
    refresh(paths(id), { store: true });
    return { refundedTotal: order.refundedTotal, status: order.status };
  });
}

export async function addOrderNoteAction(raw: unknown) {
  return adminAction("orders.write", orderNoteSchema, raw, async ({ id, body }, { actor }) => {
    await addOrderNote(id, body, actor);
    refresh(paths(id));
  });
}

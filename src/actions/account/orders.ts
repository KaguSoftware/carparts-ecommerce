"use server";

import { runAction, type ActionResult } from "@/lib/action-result";
import { resolveCart } from "@/lib/api/cart-context";
import { assertUser } from "@/lib/auth/session";
import { revalidateAccount, revalidateStore } from "@/lib/cache";
import { DomainError } from "@/lib/errors";
import { addItem } from "@/lib/services/cart";
import { cancelOwnOrder, getOrderByNumber } from "@/lib/services/orders";
import { cancelOrderSchema, orderNumberSchema } from "./orders.schema";

/**
 * Customer self-service cancellation (pending / processing orders only). Paid orders are refunded through the payment
 * provider by the service, which also queues the refund e-mail in the outbox.
 */
export async function cancelOrderAction(raw: unknown): Promise<ActionResult> {
  return runAction(cancelOrderSchema, raw, async ({ number, reason }) => {
    const user = await assertUser();
    await cancelOwnOrder({ number, userId: user.id, ...(reason ? { reason } : {}) });
    revalidateAccount();
    revalidateStore();
  });
}

/** "Buy again": puts the lines of a past order back into the cart. Lines that are gone or out of stock are skipped. */
export async function reorderAction(raw: unknown): Promise<ActionResult<{ added: number; skipped: number }>> {
  return runAction(orderNumberSchema, raw, async ({ number }) => {
    const user = await assertUser();
    const order = await getOrderByNumber(number, { userId: user.id });
    if (!order) throw new DomainError("order_not_found", { status: 404 });
    const { cart } = await resolveCart({ create: true });
    if (!cart) throw new DomainError("cart_not_found", { status: 404 });
    let added = 0;
    let skipped = 0;
    for (const item of order.items) {
      try {
        await addItem(cart.id, item.variantId, item.quantity);
        added += 1;
      } catch (error) {
        if (error instanceof DomainError) skipped += 1;
        else throw error;
      }
    }
    revalidateStore();
    return { added, skipped };
  });
}

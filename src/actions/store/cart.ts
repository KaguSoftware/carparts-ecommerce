"use server";

import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/action-result";
import { resolveCart } from "@/lib/api/cart-context";
import { DomainError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { addItem, applyCoupon, getCartView, removeCoupon, removeItem, setItemQuantity } from "@/lib/services/cart";
import type { CartView } from "@/lib/types/domain";
import { addToCartSchema, applyCouponSchema, removeFromCartSchema, setCartQuantitySchema } from "./cart.schema";

async function currentCart() {
  const { cart, userId } = await resolveCart({ create: true });
  if (!cart) throw new DomainError("cart_not_found", { status: 404 });
  return { cartId: cart.id, userId };
}

export async function addToCartAction(raw: unknown): Promise<ActionResult<CartView>> {
  return runAction(addToCartSchema, raw, async ({ variantId, quantity }) => {
    await enforceRateLimit("cart-write", { limit: 120, windowMs: 60_000 });
    const { cartId } = await currentCart();
    return addItem(cartId, variantId, quantity);
  });
}

export async function setCartQuantityAction(raw: unknown): Promise<ActionResult<CartView>> {
  return runAction(setCartQuantitySchema, raw, async ({ variantId, quantity }) => {
    await enforceRateLimit("cart-write", { limit: 120, windowMs: 60_000 });
    const { cartId } = await currentCart();
    return setItemQuantity(cartId, variantId, quantity);
  });
}

export async function removeFromCartAction(raw: unknown): Promise<ActionResult<CartView>> {
  return runAction(removeFromCartSchema, raw, async ({ variantId }) => {
    await enforceRateLimit("cart-write", { limit: 120, windowMs: 60_000 });
    const { cartId } = await currentCart();
    return removeItem(cartId, variantId);
  });
}

export async function applyCouponAction(raw: unknown): Promise<ActionResult<CartView>> {
  return runAction(applyCouponSchema, raw, async ({ code }) => {
    await enforceRateLimit("coupon", { limit: 12, windowMs: 10 * 60_000 });
    const { cartId, userId } = await currentCart();
    return applyCoupon(cartId, code, userId);
  });
}

export async function removeCouponAction(): Promise<ActionResult<CartView>> {
  return runAction(z.undefined(), undefined, async () => {
    const { cartId } = await currentCart();
    return removeCoupon(cartId);
  });
}

/** The visitor's current cart, re-priced against live stock. `null` when there is nothing yet. */
export async function getCartAction(): Promise<CartView | null> {
  try {
    const { cart } = await resolveCart({ create: false });
    return cart ? await getCartView(cart.id) : null;
  } catch {
    return null;
  }
}

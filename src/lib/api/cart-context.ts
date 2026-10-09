import "server-only";
import { getSessionUser } from "@/lib/auth/session";
import { getCartId, setCartId } from "@/lib/session/cookies";
import { getOrCreateCart } from "@/lib/services/cart";
import type { Cart, Id } from "@/lib/types/domain";

/**
 * Resolves the cart for the current request: the signed-in user's cart, else the guest cart from the signed `cart_id`
 * cookie. A cart that belongs to another account is never returned. Writes the cookie when the id changed.
 */
export async function resolveCart(opts: { create: boolean }): Promise<{ cart: Cart | null; userId: Id | null }> {
  const [user, cookieId] = await Promise.all([getSessionUser(), getCartId()]);
  const userId = user?.id ?? null;
  if (!opts.create && !userId && !cookieId) return { cart: null, userId };
  const cart = await getOrCreateCart({ cartId: cookieId, userId });
  if (cart.id !== cookieId) await setCartId(cart.id);
  return { cart, userId };
}

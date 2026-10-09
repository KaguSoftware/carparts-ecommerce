import { z } from "zod";
import { resolveCart } from "@/lib/api/cart-context";
import { assertSameOrigin, handle, json, readJson } from "@/lib/api/respond";
import { DomainError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { applyCoupon, removeCoupon } from "@/lib/services/cart";

export const dynamic = "force-dynamic";

/** POST { code } -> apply a coupon to the current cart (rate limited: codes are guessable). */
export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  await enforceRateLimit("coupon", { limit: 10, windowMs: 10 * 60_000 });
  const { code } = await readJson(request, z.object({ code: z.string().trim().min(1).max(40) }));
  const { cart, userId } = await resolveCart({ create: false });
  if (!cart) throw new DomainError("cart_empty", { status: 409 });
  const view = await applyCoupon(cart.id, code, userId);
  return json({ cart: view, count: view.totals.itemCount });
});

/** DELETE -> remove the coupon. */
export const DELETE = handle(async (request: Request) => {
  assertSameOrigin(request);
  const { cart } = await resolveCart({ create: false });
  if (!cart) return json({ cart: null, count: 0 });
  const view = await removeCoupon(cart.id);
  return json({ cart: view, count: view.totals.itemCount });
});

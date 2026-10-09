import { z } from "zod";
import { resolveCart } from "@/lib/api/cart-context";
import { assertSameOrigin, handle, json, readJson, readOptionalJson, searchParamsObject } from "@/lib/api/respond";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { addItem, clearCart, getCartView, removeItem, setItemQuantity } from "@/lib/services/cart";

export const dynamic = "force-dynamic";

const lineSchema = z.object({ variantId: z.string().min(1).max(64), quantity: z.number().int().min(0).max(1000).default(1) });
const removeSchema = z.object({ variantId: z.string().min(1).max(64).optional() });

async function respond(cartId: string) {
  const view = await getCartView(cartId);
  return json({ cart: view, count: view?.totals.itemCount ?? 0 });
}

/** GET -> { cart: CartView | null, count } for the signed-in user or the guest cookie. */
export const GET = handle(async () => {
  const { cart } = await resolveCart({ create: false });
  return cart ? respond(cart.id) : json({ cart: null, count: 0 });
});

/** POST { variantId, quantity? } -> add (or increment) a line. Prices come from the server, never the client. */
export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  await enforceRateLimit("cart", { limit: 120, windowMs: 60_000 });
  const { variantId, quantity } = await readJson(request, lineSchema.extend({ quantity: z.number().int().min(1).max(1000).default(1) }));
  const { cart } = await resolveCart({ create: true });
  const view = await addItem((cart as NonNullable<typeof cart>).id, variantId, quantity);
  return json({ cart: view, count: view.totals.itemCount });
});

/** PATCH { variantId, quantity } -> set the quantity (0 removes the line). */
export const PATCH = handle(async (request: Request) => {
  assertSameOrigin(request);
  await enforceRateLimit("cart", { limit: 120, windowMs: 60_000 });
  const { variantId, quantity } = await readJson(request, lineSchema);
  const { cart } = await resolveCart({ create: true });
  const view = await setItemQuantity((cart as NonNullable<typeof cart>).id, variantId, quantity);
  return json({ cart: view, count: view.totals.itemCount });
});

/** DELETE ?variantId= (or JSON body { variantId }) removes one line; without a variant the whole cart is emptied. */
export const DELETE = handle(async (request: Request) => {
  assertSameOrigin(request);
  await enforceRateLimit("cart", { limit: 120, windowMs: 60_000 });
  const fromQuery = searchParamsObject(new URL(request.url)).variantId;
  const body = await readOptionalJson(request, removeSchema);
  const variantId = fromQuery ?? body.variantId;
  const { cart } = await resolveCart({ create: false });
  if (!cart) return json({ cart: null, count: 0 });
  const view = variantId ? await removeItem(cart.id, variantId) : await clearCart(cart.id);
  return json({ cart: view, count: view.totals.itemCount });
});

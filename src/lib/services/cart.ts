import "server-only";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import type { Cart, CartItem, CartView, Id } from "@/lib/types/domain";
import { priceCart, toCartView } from "./_cart-pricing";
import { nowIso } from "./_shared";
import { availableOf } from "./inventory";
import { normalizeCode } from "./_coupon-rules";
import { validateCoupon } from "./coupons";
import { getSettings } from "./settings";

const CART_TTL_MS = 60 * 24 * 3_600_000;
const MAX_LINES = 50;

const freshExpiry = () => new Date(Date.now() + CART_TTL_MS).toISOString();

async function loadLiveCart(cartId: Id): Promise<Cart | null> {
  const cart = await db.carts.get(cartId);
  if (!cart) return null;
  if (Date.parse(cart.expiresAt) < Date.now()) return null;
  return cart;
}

async function requireCart(cartId: Id): Promise<Cart> {
  const cart = await loadLiveCart(cartId);
  if (!cart) throw new DomainError("cart_not_found", { status: 404 });
  return cart;
}

export async function getOrCreateCart(opts: { cartId?: Id | null; userId?: Id | null }): Promise<Cart> {
  return db.transaction(async () => {
    if (opts.userId) {
      const own = await db.carts.find({ where: (c) => c.userId === opts.userId, orderBy: [{ field: "updatedAt", direction: "desc" }], limit: 1 });
      if (own[0] && Date.parse(own[0].expiresAt) >= Date.now()) return own[0];
    }
    if (opts.cartId) {
      const existing = await loadLiveCart(opts.cartId);
      // A guest cookie must never expose someone else's account cart.
      if (existing && (existing.userId === null || existing.userId === opts.userId)) {
        if (opts.userId && existing.userId === null) {
          // First touch after login with a guest cart and no account cart: adopt it.
          return db.carts.update(existing.id, { userId: opts.userId, updatedAt: nowIso(), expiresAt: freshExpiry() });
        }
        return existing;
      }
    }
    const at = nowIso();
    return db.carts.insert({ userId: opts.userId ?? null, items: [], expiresAt: freshExpiry(), createdAt: at, updatedAt: at });
  });
}

export async function getCartView(cartId: Id): Promise<CartView | null> {
  const cart = await loadLiveCart(cartId);
  if (!cart) return null;
  const priced = await priceCart(cart, { userId: cart.userId });
  if (priced.dirty) {
    // Persist the cleanup (dropped lines, clamped quantities, invalid coupon) against the latest stored cart.
    await db.transaction(async () => {
      const latest = await db.carts.get(cartId);
      if (!latest) return;
      const again = await priceCart(latest, { userId: latest.userId });
      await db.carts.update(cartId, { items: again.items, couponCode: again.couponCode, updatedAt: nowIso() });
    });
  }
  return toCartView(cartId, priced);
}

export async function getCartItemCount(cartId: Id | null | undefined): Promise<number> {
  if (!cartId) return 0;
  const cart = await loadLiveCart(cartId);
  if (!cart) return 0;
  return cart.items.reduce((s, i) => s + i.quantity, 0);
}

/**
 * Read-only lookup of the cart a visitor already has (Store): the signed-in user's cart, else the guest cart from the
 * cookie. Unlike getOrCreateCart it never writes, so it is safe to call while rendering a server component.
 */
export async function peekCartId(opts: { cartId?: Id | null; userId?: Id | null }): Promise<Id | null> {
  if (opts.userId) {
    const own = await db.carts.find({ where: (c) => c.userId === opts.userId, orderBy: [{ field: "updatedAt", direction: "desc" }], limit: 1 });
    if (own[0] && Date.parse(own[0].expiresAt) >= Date.now()) return own[0].id;
  }
  if (!opts.cartId) return null;
  const cart = await loadLiveCart(opts.cartId);
  if (!cart || (cart.userId !== null && cart.userId !== opts.userId)) return null;
  return cart.id;
}

/** Read-only item count for header badges. */
export async function peekCartItemCount(opts: { cartId?: Id | null; userId?: Id | null }): Promise<number> {
  return getCartItemCount(await peekCartId(opts));
}

function assertQuantity(quantity: number, min: number, max: number) {
  if (!Number.isInteger(quantity) || quantity < min || quantity > max) throw new DomainError("quantity_invalid", { status: 400, params: { max } });
}

/** Validates the wanted quantity of a variant against stock + per-line cap and returns its live price. */
async function checkLine(variantId: Id, quantity: number) {
  const settings = await getSettings();
  const variant = await db.variants.get(variantId);
  if (!variant || !variant.isActive) throw new DomainError("variant_unavailable", { status: 409 });
  const product = await db.products.get(variant.productId);
  if (!product || product.status !== "active") throw new DomainError("product_unavailable", { status: 409 });
  const available = availableOf(variant);
  if (available <= 0) throw new DomainError("out_of_stock", { status: 409, params: { available: 0 } });
  if (quantity > settings.checkout.maxQuantityPerLine) throw new DomainError("quantity_invalid", { status: 400, params: { max: settings.checkout.maxQuantityPerLine } });
  if (quantity > available) throw new DomainError("insufficient_stock", { status: 409, params: { available } });
  return variant;
}

async function save(cart: Cart, items: CartItem[], extra: Partial<Cart> = {}): Promise<void> {
  await db.carts.update(cart.id, { items, ...extra, updatedAt: nowIso(), expiresAt: freshExpiry() });
}

export async function addItem(cartId: Id, variantId: Id, quantity: number): Promise<CartView> {
  assertQuantity(quantity, 1, 1000);
  await db.transaction(async () => {
    const cart = await requireCart(cartId);
    const existing = cart.items.find((i) => i.variantId === variantId);
    const wanted = (existing?.quantity ?? 0) + quantity;
    const variant = await checkLine(variantId, wanted);
    if (!existing && cart.items.length >= MAX_LINES) throw new DomainError("quantity_invalid", { status: 400 });
    const items = existing
      ? cart.items.map((i) => (i.variantId === variantId ? { ...i, quantity: wanted, priceAtAdd: variant.price } : i))
      : [...cart.items, { variantId, quantity, addedAt: nowIso(), priceAtAdd: variant.price }];
    await save(cart, items);
  });
  return viewOrThrow(cartId);
}

export async function setItemQuantity(cartId: Id, variantId: Id, quantity: number): Promise<CartView> {
  assertQuantity(quantity, 0, 1000);
  await db.transaction(async () => {
    const cart = await requireCart(cartId);
    if (quantity === 0) {
      await save(cart, cart.items.filter((i) => i.variantId !== variantId));
      return;
    }
    const variant = await checkLine(variantId, quantity);
    const exists = cart.items.some((i) => i.variantId === variantId);
    if (!exists && cart.items.length >= MAX_LINES) throw new DomainError("quantity_invalid", { status: 400 });
    const items = exists
      ? cart.items.map((i) => (i.variantId === variantId ? { ...i, quantity, priceAtAdd: variant.price } : i))
      : [...cart.items, { variantId, quantity, addedAt: nowIso(), priceAtAdd: variant.price }];
    await save(cart, items);
  });
  return viewOrThrow(cartId);
}

export async function removeItem(cartId: Id, variantId: Id): Promise<CartView> {
  await db.transaction(async () => {
    const cart = await requireCart(cartId);
    await save(cart, cart.items.filter((i) => i.variantId !== variantId));
  });
  return viewOrThrow(cartId);
}

export async function clearCart(cartId: Id): Promise<CartView> {
  await db.transaction(async () => {
    const cart = await requireCart(cartId);
    await save(cart, [], { couponCode: undefined });
  });
  return viewOrThrow(cartId);
}

export async function applyCoupon(cartId: Id, code: string, userId?: Id | null): Promise<CartView> {
  const normalized = normalizeCode(code);
  if (!normalized) throw new DomainError("coupon_invalid", { status: 409 });
  const cart = await requireCart(cartId);
  if (cart.items.length === 0) throw new DomainError("cart_empty", { status: 409 });
  // Validate against the live priced cart WITH the candidate code; priceCart swallows coupon errors, so probe first.
  const probe = await priceCart({ ...cart, couponCode: undefined }, { userId: userId ?? cart.userId });
  if (probe.lines.length === 0) throw new DomainError("cart_empty", { status: 409 });
  await validateCoupon({ code: normalized, lines: probe.couponLines, subtotal: probe.subtotal, userId: userId ?? cart.userId });
  await db.transaction(async () => {
    const latest = await requireCart(cartId);
    await save(latest, latest.items, { couponCode: normalized });
  });
  return viewOrThrow(cartId);
}

export async function removeCoupon(cartId: Id): Promise<CartView> {
  await db.transaction(async () => {
    const cart = await requireCart(cartId);
    await save(cart, cart.items, { couponCode: undefined });
  });
  return viewOrThrow(cartId);
}

export async function mergeGuestCart(guestCartId: Id, userId: Id): Promise<Cart> {
  return db.transaction(async () => {
    const guest = await loadLiveCart(guestCartId);
    const ownList = await db.carts.find({ where: (c) => c.userId === userId, orderBy: [{ field: "updatedAt", direction: "desc" }] });
    let own = ownList.find((c) => Date.parse(c.expiresAt) >= Date.now());
    const at = nowIso();
    if (!own) {
      // Prefer adopting the guest cart wholesale: nothing to merge.
      if (guest && guest.userId === null) return db.carts.update(guest.id, { userId, updatedAt: at, expiresAt: freshExpiry() });
      own = await db.carts.insert({ userId, items: [], expiresAt: freshExpiry(), createdAt: at, updatedAt: at });
    }
    if (!guest || guest.id === own.id || guest.userId !== null) return own;

    const settings = await getSettings();
    const items = new Map(own.items.map((i) => [i.variantId, { ...i }]));
    for (const g of guest.items) {
      const variant = await db.variants.get(g.variantId);
      if (!variant || !variant.isActive) continue;
      const cap = Math.min(availableOf(variant), settings.checkout.maxQuantityPerLine);
      if (cap <= 0) continue;
      const current = items.get(g.variantId);
      const quantity = Math.min(cap, (current?.quantity ?? 0) + g.quantity);
      items.set(g.variantId, { variantId: g.variantId, quantity, addedAt: current?.addedAt ?? g.addedAt, priceAtAdd: current?.priceAtAdd ?? g.priceAtAdd });
    }
    const merged = await db.carts.update(own.id, {
      items: [...items.values()].slice(0, MAX_LINES),
      couponCode: own.couponCode ?? guest.couponCode,
      updatedAt: at,
      expiresAt: freshExpiry(),
    });
    await db.carts.delete(guest.id);
    return merged;
  });
}

/**
 * Read-only lookup of "the cart this visitor sees" for server components: the signed-in user's latest live cart,
 * else the guest cart addressed by the (signed) cookie id. Never creates or adopts a cart, so it is safe to call
 * while rendering (no cookie writes). Returns null when there is nothing to show.
 */
export async function findCartView(opts: { cartId?: Id | null; userId?: Id | null }): Promise<CartView | null> {
  if (opts.userId) {
    const own = await db.carts.find({ where: (c) => c.userId === opts.userId, orderBy: [{ field: "updatedAt", direction: "desc" }], limit: 1 });
    if (own[0] && Date.parse(own[0].expiresAt) >= Date.now()) return getCartView(own[0].id);
  }
  if (opts.cartId) {
    const cart = await loadLiveCart(opts.cartId);
    if (cart && (cart.userId === null || cart.userId === opts.userId)) return getCartView(cart.id);
  }
  return null;
}

async function viewOrThrow(cartId: Id): Promise<CartView> {
  const view = await getCartView(cartId);
  if (!view) throw new DomainError("cart_not_found", { status: 404 });
  return view;
}

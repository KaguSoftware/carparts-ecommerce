import "server-only";
import { db } from "@/lib/db";
import { isDomainError } from "@/lib/errors";
import type { Brand, Cart, CartItem, CartLine, CartTotals, CartView, CartWarning, Cents, CouponApplication, Id, Product, ProductVariant } from "@/lib/types/domain";
import { availableOf } from "./inventory";
import { getSettings } from "./settings";
import { validateCoupon } from "./coupons";
import type { CouponLine } from "./_coupon-rules";

/**
 * Server-side cart pricing. The ONLY place cart lines get their prices: client-provided money is never used.
 * Shared by cart.ts (views) and checkout.ts (authoritative totals).
 */

export interface PricedCart {
  lines: CartLine[];
  /** Items that survived validation (quantities clamped, dead lines dropped). */
  items: CartItem[];
  warnings: CartWarning[];
  /** True when `items` or the coupon differ from what is stored (caller may persist). */
  dirty: boolean;
  couponCode?: string;
  application?: CouponApplication;
  couponLines: (CouponLine & { variantId: Id })[];
  subtotal: Cents;
  discount: Cents;
  itemCount: number;
  totalWeightGrams: number;
  freeShipping: boolean;
  settings: Awaited<ReturnType<typeof getSettings>>;
}

export async function priceCart(cart: Cart, who: { userId?: Id | null; email?: string } = {}): Promise<PricedCart> {
  const settings = await getSettings();
  const maxPerLine = settings.checkout.maxQuantityPerLine;
  const variants = new Map((await db.variants.getMany(cart.items.map((i) => i.variantId))).map((v) => [v.id, v]));
  const products = new Map((await db.products.getMany([...new Set([...variants.values()].map((v) => v.productId))])).map((p) => [p.id, p]));
  const brands = new Map((await db.brands.getMany([...new Set([...products.values()].map((p) => p.brandId))])).map((b) => [b.id, b]));

  const warnings: CartWarning[] = [];
  const lines: CartLine[] = [];
  const items: CartItem[] = [];
  const couponLines: PricedCart["couponLines"] = [];
  let dirty = false;
  let totalWeightGrams = 0;

  for (const item of cart.items) {
    const variant: ProductVariant | undefined = variants.get(item.variantId);
    const product: Product | undefined = variant ? products.get(variant.productId) : undefined;
    const brand: Brand | undefined = product ? brands.get(product.brandId) : undefined;
    if (!variant || !variant.isActive || !product || product.status !== "active" || !brand) {
      warnings.push({ type: "item_removed", variantId: item.variantId, reason: "unavailable" });
      dirty = true;
      continue;
    }
    const available = availableOf(variant);
    // Stock-driven adjustments are view-only: other shoppers' reservations are temporary, so the stored cart keeps
    // the line and its quantity (never marked dirty) and the shopper just sees a warning.
    const cap = Math.min(Math.max(0, available), maxPerLine);
    let quantity = item.quantity;
    if (available <= 0) {
      warnings.push({ type: "item_removed", variantId: item.variantId, reason: "out_of_stock" });
    } else if (quantity > cap) {
      warnings.push({ type: "quantity_reduced", variantId: item.variantId, requested: quantity, available: cap });
      quantity = cap;
    }
    if (item.priceAtAdd !== variant.price) warnings.push({ type: "price_changed", variantId: item.variantId, from: item.priceAtAdd, to: variant.price });

    const image = product.images.find((i) => i.id === variant.imageId) ?? [...product.images].sort((a, b) => a.sortOrder - b.sortOrder)[0];
    const lineTotal = variant.price * quantity;
    lines.push({
      variantId: variant.id,
      productId: product.id,
      slug: product.slug,
      sku: variant.sku,
      partNumber: product.partNumber,
      name: product.name,
      variantName: variant.name,
      brandName: brand.name,
      ...(image ? { image: image.url } : {}),
      quantity,
      unitPrice: variant.price,
      ...(variant.compareAtPrice !== undefined && variant.compareAtPrice > variant.price ? { compareAtPrice: variant.compareAtPrice } : {}),
      lineTotal,
      available,
      maxQuantity: cap,
    });
    items.push({ ...item });
    couponLines.push({ variantId: variant.id, productId: product.id, brandId: product.brandId, categoryIds: product.categoryIds, lineTotal });
    totalWeightGrams += variant.weightGrams * quantity;
  }

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);

  let application: CouponApplication | undefined;
  let couponCode = cart.couponCode;
  if (couponCode) {
    if (lines.length === 0) {
      warnings.push({ type: "coupon_removed", code: couponCode, reason: "cart_empty" });
      couponCode = undefined;
      dirty = true;
    } else {
      try {
        application = await validateCoupon({ code: couponCode, lines: couponLines, subtotal, userId: who.userId, email: who.email });
      } catch (e) {
        if (!isDomainError(e)) throw e;
        warnings.push({ type: "coupon_removed", code: couponCode, reason: e.code });
        couponCode = undefined;
        dirty = true;
      }
    }
  }

  return {
    lines,
    items,
    warnings,
    dirty,
    ...(couponCode ? { couponCode } : {}),
    ...(application ? { application } : {}),
    couponLines,
    subtotal,
    discount: application?.discount ?? 0,
    itemCount,
    totalWeightGrams,
    freeShipping: application?.freeShipping ?? false,
    settings,
  };
}

export function toCartView(cartId: Id, priced: PricedCart): CartView {
  const afterDiscount = priced.subtotal - priced.discount;
  const threshold = priced.settings.checkout.freeShippingThreshold;
  const totals: CartTotals = {
    subtotal: priced.subtotal,
    discount: priced.discount,
    shipping: 0,
    tax: 0,
    total: afterDiscount,
    itemCount: priced.itemCount,
    freeShippingRemaining: threshold > 0 && !priced.freeShipping && priced.lines.length > 0 ? Math.max(0, threshold - afterDiscount) : 0,
  };
  return {
    id: cartId,
    lines: priced.lines,
    ...(priced.application
      ? { coupon: { code: priced.application.coupon.code, type: priced.application.coupon.type, discount: priced.application.discount, freeShipping: priced.application.freeShipping } }
      : {}),
    totals,
    warnings: priced.warnings,
  };
}

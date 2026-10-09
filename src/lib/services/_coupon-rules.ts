import "server-only";
import { DomainError } from "@/lib/errors";
import { percentOf } from "@/lib/money";
import type { Cents, Coupon, Id } from "@/lib/types/domain";

/** Pure coupon rules (no I/O). Usage limits need the redemption table and live in coupons.ts. */

export interface CouponLine {
  productId: Id;
  brandId: Id;
  categoryIds: Id[];
  lineTotal: Cents;
}

export interface CouponEvaluation {
  discount: Cents;
  freeShipping: boolean;
  /** Per input line: the part of its total this coupon applies to (0 when the line is out of scope). */
  eligibleAmounts: Cents[];
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export function lineInScope(coupon: Pick<Coupon, "appliesTo">, line: CouponLine): boolean {
  const scope = coupon.appliesTo;
  if (!scope) return true;
  const categories = scope.categoryIds ?? [];
  const brands = scope.brandIds ?? [];
  const products = scope.productIds ?? [];
  if (categories.length === 0 && brands.length === 0 && products.length === 0) return true;
  return (
    products.includes(line.productId) ||
    brands.includes(line.brandId) ||
    line.categoryIds.some((c) => categories.includes(c))
  );
}

export function isScoped(coupon: Pick<Coupon, "appliesTo">): boolean {
  const s = coupon.appliesTo;
  return Boolean(s && ((s.categoryIds?.length ?? 0) > 0 || (s.brandIds?.length ?? 0) > 0 || (s.productIds?.length ?? 0) > 0));
}

/**
 * Validates everything that depends only on the coupon row and the cart snapshot:
 * active flag, schedule, minimum spend, scope. Throws coupon_* DomainErrors.
 */
export function evaluateCoupon(coupon: Coupon, lines: CouponLine[], subtotal: Cents, now: Date = new Date()): CouponEvaluation {
  if (!coupon.isActive) throw new DomainError("coupon_invalid", { status: 409 });
  if (coupon.startsAt && Date.parse(coupon.startsAt) > now.getTime()) throw new DomainError("coupon_not_started", { status: 409 });
  if (coupon.endsAt && Date.parse(coupon.endsAt) < now.getTime()) throw new DomainError("coupon_expired", { status: 409 });
  if (coupon.minSubtotal !== undefined && subtotal < coupon.minSubtotal) {
    throw new DomainError("coupon_min_subtotal", { status: 409, params: { min: coupon.minSubtotal } });
  }

  const eligibleAmounts = lines.map((l) => (lineInScope(coupon, l) ? l.lineTotal : 0));
  const eligibleSubtotal = eligibleAmounts.reduce((a, b) => a + b, 0);
  if (isScoped(coupon) && eligibleSubtotal <= 0) throw new DomainError("coupon_not_applicable", { status: 409 });

  let discount = 0;
  let freeShipping = false;
  switch (coupon.type) {
    case "percent": {
      discount = percentOf(eligibleSubtotal, coupon.value);
      if (coupon.maxDiscount !== undefined) discount = Math.min(discount, coupon.maxDiscount);
      break;
    }
    case "fixed":
      discount = Math.min(coupon.value, eligibleSubtotal);
      break;
    case "free_shipping":
      freeShipping = true;
      break;
  }
  discount = Math.max(0, Math.min(discount, subtotal));
  return { discount, freeShipping, eligibleAmounts };
}

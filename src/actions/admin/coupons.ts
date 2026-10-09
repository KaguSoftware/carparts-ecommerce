"use server";

import { createCoupon, deleteCoupon, updateCoupon } from "@/lib/services/coupons";
import type { CouponInput } from "@/lib/services/contracts";
import { adminAction, prefixFieldErrors, refresh } from "./_shared";
import { deleteCouponSchema, saveCouponSchema, type CouponFormInput } from "./coupons.schema";

function toInput(c: CouponFormInput): CouponInput {
  const appliesTo = {
    ...(c.categoryIds.length ? { categoryIds: c.categoryIds } : {}),
    ...(c.brandIds.length ? { brandIds: c.brandIds } : {}),
  };
  return {
    code: c.code.toUpperCase(),
    description: c.description,
    type: c.type,
    value: c.type === "free_shipping" ? 0 : c.value,
    ...(c.minSubtotal ? { minSubtotal: c.minSubtotal } : {}),
    ...(c.type === "percent" && c.maxDiscount ? { maxDiscount: c.maxDiscount } : {}),
    ...(c.startsAt ? { startsAt: `${c.startsAt}T00:00:00.000Z` } : {}),
    ...(c.endsAt ? { endsAt: `${c.endsAt}T23:59:59.000Z` } : {}),
    ...(c.usageLimit ? { usageLimit: c.usageLimit } : {}),
    ...(c.perUserLimit ? { perUserLimit: c.perUserLimit } : {}),
    ...(Object.keys(appliesTo).length ? { appliesTo } : {}),
    isActive: c.isActive,
  };
}

export async function saveCouponAction(raw: unknown) {
  return adminAction("marketing.write", saveCouponSchema, raw, async ({ id, coupon }, { actor }) => {
    const input = toInput(coupon);
    const saved = id
      ? await updateCoupon(id, { ...input, ...(input.minSubtotal ? {} : { minSubtotal: undefined }) }, actor).catch((e) => prefixFieldErrors(e, "coupon"))
      : await createCoupon(input, actor).catch((e) => prefixFieldErrors(e, "coupon"));
    refresh(["/admin/coupons"]);
    return { id: saved.id };
  });
}

export async function deleteCouponAction(raw: unknown) {
  return adminAction("marketing.write", deleteCouponSchema, raw, async ({ id }, { actor }) => {
    await deleteCoupon(id, actor);
    refresh(["/admin/coupons"]);
  });
}

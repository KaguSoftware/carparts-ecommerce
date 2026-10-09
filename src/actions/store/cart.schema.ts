import { z } from "zod";
import { idSchema } from "@/lib/validation/common";

export const addToCartSchema = z.object({
  variantId: idSchema,
  quantity: z.number({ error: "number_invalid" }).int("integer_required").min(1, "must_be_positive").max(99, "too_large"),
});

export const setCartQuantitySchema = z.object({
  variantId: idSchema,
  quantity: z.number({ error: "number_invalid" }).int("integer_required").min(0, "must_not_be_negative").max(99, "too_large"),
});

export const removeFromCartSchema = z.object({ variantId: idSchema });

export const applyCouponSchema = z.object({
  code: z.string().trim().min(1, "required").max(40, "too_long"),
});

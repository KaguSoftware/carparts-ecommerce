import { z } from "zod";
import { idSchema, localizedStringSchema } from "@/lib/validation/common";

const intNumber = z.number({ error: "number_invalid" }).int("integer_required");
const cents = intNumber.min(0, "must_not_be_negative").max(1_000_000_000, "too_large");
const dateText = z.string().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "date_invalid");

export const couponInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, "too_short")
      .max(30, "too_long")
      .regex(/^[A-Za-z0-9_-]+$/, "invalid_value"),
    description: localizedStringSchema({ required: false, max: 200 }),
    type: z.enum(["percent", "fixed", "free_shipping"]),
    /** percent: 1-100, fixed: USD cents, free_shipping: ignored. */
    value: intNumber.min(0, "must_not_be_negative").max(1_000_000_000, "too_large"),
    minSubtotal: cents.optional(),
    maxDiscount: cents.optional(),
    startsAt: dateText,
    endsAt: dateText,
    usageLimit: intNumber.min(1, "must_be_positive").max(10_000_000, "too_large").optional(),
    perUserLimit: intNumber.min(1, "must_be_positive").max(1000, "too_large").optional(),
    categoryIds: z.array(z.string()).max(200),
    brandIds: z.array(z.string()).max(200),
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "percent" && (v.value < 1 || v.value > 100)) ctx.addIssue({ code: "custom", path: ["value"], message: "invalid_value" });
    if (v.type === "fixed" && v.value < 1) ctx.addIssue({ code: "custom", path: ["value"], message: "must_be_positive" });
    if (v.startsAt && v.endsAt && v.endsAt < v.startsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "date_range_invalid" });
  });
export type CouponFormInput = z.infer<typeof couponInputSchema>;

export const saveCouponSchema = z.object({ id: z.string().optional(), coupon: couponInputSchema });
export const deleteCouponSchema = z.object({ id: idSchema });

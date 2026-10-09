import { z } from "zod";
import { idSchema } from "@/lib/validation/common";

const note = z.string().trim().max(500, "too_long").optional();

export const adjustStockSchema = z.object({
  variantId: idSchema,
  delta: z
    .number({ error: "number_invalid" })
    .int("integer_required")
    .refine((n) => n !== 0, "invalid_value")
    .refine((n) => Math.abs(n) <= 1_000_000, "too_large"),
  reason: z.enum(["adjustment", "purchase", "damage", "correction", "return"]),
  note,
  reference: z.string().trim().max(60, "too_long").optional(),
});

export const setStockSchema = z.object({
  variantId: idSchema,
  onHand: z.number({ error: "number_invalid" }).int("integer_required").min(0, "must_not_be_negative").max(10_000_000, "too_large"),
  note,
});

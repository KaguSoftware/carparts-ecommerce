import { z } from "zod";

export const orderNumberSchema = z.object({
  number: z.string().trim().min(3, "required").max(32, "too_long"),
});

export const cancelOrderSchema = orderNumberSchema.extend({
  reason: z.string().trim().max(200, "too_long").optional(),
});

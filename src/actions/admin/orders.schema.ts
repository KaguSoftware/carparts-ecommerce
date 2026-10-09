import { z } from "zod";
import { idSchema } from "@/lib/validation/common";

const reason = z.string().trim().min(1, "required").max(500, "too_long");

export const updateStatusSchema = z.object({
  id: idSchema,
  status: z.enum(["pending_payment", "processing", "shipped", "delivered", "cancelled", "refunded"]),
  note: z.string().trim().max(500, "too_long").optional(),
});

export const shipOrderSchema = z.object({
  id: idSchema,
  carrier: z.string().trim().max(60, "too_long"),
  trackingNumber: z.string().trim().max(100, "too_long"),
  notifyCustomer: z.boolean(),
});

export const deliverOrderSchema = z.object({ id: idSchema });

export const cancelOrderSchema = z.object({ id: idSchema, reason, restock: z.boolean(), refund: z.boolean() });

export const refundOrderSchema = z.object({
  id: idSchema,
  /** all = whatever is left; items = selected lines (+ shipping); amount = a custom USD amount. */
  mode: z.enum(["all", "items", "amount"]),
  items: z.array(z.object({ orderItemId: idSchema, quantity: z.number().int().min(0).max(1000) })).max(200),
  includeShipping: z.boolean(),
  amount: z.number({ error: "number_invalid" }).int("integer_required").min(1, "must_be_positive").max(1_000_000_000, "too_large").optional(),
  reason,
  restock: z.boolean(),
});

export const orderNoteSchema = z.object({ id: idSchema, body: z.string().trim().min(1, "required").max(2000, "too_long") });

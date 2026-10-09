import { z } from "zod";
import { addressInputSchema, idSchema } from "@/lib/validation/common";

export const saveAddressSchema = addressInputSchema.extend({
  id: idSchema.optional(),
  isDefaultShipping: z.boolean().default(false),
  isDefaultBilling: z.boolean().default(false),
});

export const addressIdSchema = z.object({ id: idSchema });

export const setDefaultAddressSchema = z.object({
  id: idSchema,
  kind: z.enum(["shipping", "billing"]),
});

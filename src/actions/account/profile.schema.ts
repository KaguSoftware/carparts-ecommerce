import { z } from "zod";
import { emailSchema, localeSchema, phoneSchema } from "@/lib/validation/common";

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "required").max(80, "too_long"),
  phone: z.union([phoneSchema, z.literal("")]).optional(),
  locale: localeSchema,
  marketingOptIn: z.boolean(),
});
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;

export const deleteAccountSchema = z.object({
  confirmEmail: emailSchema,
  locale: localeSchema,
});

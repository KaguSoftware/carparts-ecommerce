import { z } from "zod";
import { idSchema, localizedStringSchema } from "@/lib/validation/common";

const intNumber = z.number({ error: "number_invalid" }).int("integer_required");
const cents = intNumber.min(0, "must_not_be_negative").max(1_000_000_000, "too_large");

export const shippingMethodSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, "too_short")
      .max(30, "too_long")
      .regex(/^[a-z0-9_-]+$/, "invalid_value"),
    name: localizedStringSchema({ max: 80 }),
    description: localizedStringSchema({ required: false, max: 300 }),
    /** ISO alpha-2 codes, or "*" for everywhere. */
    countries: z.array(z.string().trim().toUpperCase().regex(/^([A-Z]{2}|\*)$/, "country_invalid")).min(1, "required").max(250),
    price: cents,
    perKgPrice: cents,
    freeOverSubtotal: cents.optional(),
    estimatedDaysMin: intNumber.min(0, "must_not_be_negative").max(365, "too_large"),
    estimatedDaysMax: intNumber.min(0, "must_not_be_negative").max(365, "too_large"),
    isActive: z.boolean(),
    sortOrder: intNumber.min(0, "must_not_be_negative").max(10_000, "too_large"),
  })
  .refine((v) => v.estimatedDaysMax >= v.estimatedDaysMin, { path: ["estimatedDaysMax"], message: "invalid_value" });
export type ShippingFormInput = z.infer<typeof shippingMethodSchema>;

export const saveShippingSchema = z.object({ id: z.string().optional(), method: shippingMethodSchema });

export const taxRateSchema = z.object({
  name: localizedStringSchema({ max: 80 }),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "country_invalid"),
  /** Empty = the whole country. */
  region: z.string().trim().max(80, "too_long"),
  /** Percent with up to two decimals, entered as basis points in the form (825 = 8.25%). */
  rateBps: intNumber.min(0, "must_not_be_negative").max(10_000, "too_large"),
  appliesToShipping: z.boolean(),
  isActive: z.boolean(),
});
export type TaxFormInput = z.infer<typeof taxRateSchema>;

export const saveTaxSchema = z.object({ id: z.string().optional(), rate: taxRateSchema });
export const deleteByIdSchema = z.object({ id: idSchema });

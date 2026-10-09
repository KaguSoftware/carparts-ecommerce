import { z } from "zod";

const intNumber = z.number({ error: "number_invalid" }).int("integer_required");
const loc = (max: number) => z.object({ en: z.string().trim().max(max, "too_long"), tr: z.string().trim().max(max, "too_long") });
const country = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "country_invalid");
const optionalUrl = z
  .string()
  .trim()
  .max(300, "too_long")
  .refine((v) => v === "" || /^https?:\/\//i.test(v), "url_invalid");

export const settingsFormSchema = z.object({
  store: z.object({
    name: z.string().trim().min(1, "required").max(80, "too_long"),
    legalEntity: z.string().trim().max(120, "too_long"),
    email: z.string().trim().min(1, "required").email("email_invalid").max(254, "too_long"),
    phone: z.string().trim().max(40, "too_long"),
    taxId: z.string().trim().max(40, "too_long"),
    address: z.object({
      line1: z.string().trim().max(120, "too_long"),
      city: z.string().trim().max(80, "too_long"),
      region: z.string().trim().max(80, "too_long"),
      postalCode: z.string().trim().max(20, "too_long"),
      country,
    }),
  }),
  currency: z.object({
    tryPerUsd: z.number({ error: "number_invalid" }).positive("must_be_positive").max(10_000, "too_large"),
  }),
  checkout: z.object({
    guestCheckout: z.boolean(),
    orderNumberPrefix: z.string().trim().regex(/^[A-Za-z0-9-]{0,8}$/, "invalid_value"),
    maxQuantityPerLine: intNumber.min(1, "must_be_positive").max(100, "too_large"),
    freeShippingThreshold: intNumber.min(0, "must_not_be_negative").max(100_000_000, "too_large"),
    defaultCountry: country,
    shippableCountries: z.array(country).min(1, "required").max(250, "too_large"),
    reservationMinutes: intNumber.min(5, "invalid_value").max(1440, "too_large"),
  }),
  inventory: z.object({
    defaultLowStockThreshold: intNumber.min(0, "must_not_be_negative").max(10_000, "too_large"),
    allowBackorders: z.boolean(),
  }),
  seo: z.object({ defaultTitle: loc(500), defaultDescription: loc(500) }),
  social: z.object({ instagram: optionalUrl, youtube: optionalUrl, x: optionalUrl, facebook: optionalUrl }),
  maintenanceMode: z.boolean(),
  emails: z.object({
    orderConfirmation: z.boolean(),
    shippingUpdate: z.boolean(),
    adminNewOrder: z.boolean(),
    adminAddress: z
      .string()
      .trim()
      .max(254, "too_long")
      .refine((v) => v === "" || z.string().email().safeParse(v).success, "email_invalid"),
  }),
});
export type SettingsFormInput = z.infer<typeof settingsFormSchema>;

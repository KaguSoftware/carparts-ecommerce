import { z } from "zod";
import { LOCALES } from "@/i18n/routing";

/**
 * Shared zod building blocks. RULE: every custom message is a validation CODE (a key under the
 * `validation` message namespace), never English prose. UI translates with t(`validation.${code}`).
 */
export const idSchema = z.string().min(1, "required").max(64, "too_long");

export const emailSchema = z.string().trim().toLowerCase().min(1, "required").max(254, "too_long").email("email_invalid");

export const passwordSchema = z
  .string()
  .min(10, "password_too_short")
  .max(128, "too_long")
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v), "password_weak");

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+()\-.\s\d]{7,20}$/, "phone_invalid");

export const slugSchema = z
  .string()
  .trim()
  .min(1, "required")
  .max(96, "too_long")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug_invalid");

export const positiveIntSchema = z.number({ error: "number_invalid" }).int("integer_required").positive("must_be_positive");
export const nonNegativeIntSchema = z.number({ error: "number_invalid" }).int("integer_required").min(0, "must_not_be_negative");

/** USD minor units (integer cents). */
export const centsSchema = z
  .number({ error: "number_invalid" })
  .int("integer_required")
  .min(0, "must_not_be_negative")
  .max(10_000_000_000, "too_large");

export const localeSchema = z.enum(LOCALES);

/** { en, tr }: the English value is required (unless `required: false`), Turkish may be empty (UI warns). */
export function localizedStringSchema(opts: { required?: boolean; max?: number } = {}) {
  const max = opts.max ?? 5000;
  const base = z.string().trim().max(max, "too_long");
  return z.object({ en: opts.required === false ? base : base.min(1, "required"), tr: base });
}

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).catch(24).default(24),
});

export const countryCodeSchema = z.string().trim().length(2, "country_invalid").toUpperCase();

export const addressInputSchema = z.object({
  label: z.string().trim().max(40, "too_long").optional(),
  firstName: z.string().trim().min(1, "required").max(60, "too_long"),
  lastName: z.string().trim().min(1, "required").max(60, "too_long"),
  company: z.string().trim().max(100, "too_long").optional(),
  line1: z.string().trim().min(3, "required").max(120, "too_long"),
  line2: z.string().trim().max(120, "too_long").optional(),
  city: z.string().trim().min(1, "required").max(80, "too_long"),
  region: z.string().trim().max(80, "too_long").default(""),
  postalCode: z.string().trim().min(2, "required").max(12, "too_long"),
  country: countryCodeSchema,
  phone: phoneSchema,
});

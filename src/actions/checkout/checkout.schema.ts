import { z } from "zod";
import { addressInputSchema, countryCodeSchema, emailSchema, localeSchema } from "@/lib/validation/common";

/** Server-side schemas for the checkout actions. Messages are validation codes (see ARCHITECTURE.md > Server Actions). */

export const checkoutQuoteSchema = z.object({
  country: countryCodeSchema,
  region: z.string().trim().max(80, "too_long").default(""),
  postalCode: z.string().trim().max(12, "too_long").optional(),
  shippingMethodId: z.string().trim().max(64).optional(),
  locale: localeSchema,
});

const cardSchema = z.object({
  number: z.string().trim().min(12, "card_number_invalid").max(30, "card_number_invalid"),
  expMonth: z.number({ error: "card_expiry_invalid" }).int("card_expiry_invalid").min(1, "card_expiry_invalid").max(12, "card_expiry_invalid"),
  expYear: z.number({ error: "card_expiry_invalid" }).int("card_expiry_invalid").min(0, "card_expiry_invalid").max(2200, "card_expiry_invalid"),
  cvc: z.string().trim().min(3, "card_cvc_invalid").max(4, "card_cvc_invalid"),
  holder: z.string().trim().min(2, "required").max(80, "too_long"),
});

export const placeOrderSchema = z.object({
  /** Ignored for signed-in customers (their account email is used). Required for guests. */
  email: emailSchema.optional(),
  locale: localeSchema,
  shippingAddress: addressInputSchema,
  billingAddress: addressInputSchema.optional(),
  shippingMethodId: z.string().trim().min(1, "required").max(64, "too_long"),
  customerNote: z.string().trim().max(500, "too_long").optional(),
  newsletterOptIn: z.boolean().default(false),
  saveAddress: z.boolean().default(false),
  acceptTerms: z.boolean().refine((v) => v === true, "terms_required"),
  /** One UUID per checkout attempt, reused for retries of the same cart. */
  idempotencyKey: z
    .string()
    .trim()
    .min(8, "too_short")
    .max(128, "too_long")
    .regex(/^[A-Za-z0-9._:-]+$/, "invalid_value"),
  /** USD cents the customer saw; a mismatch fails with `price_changed` instead of charging a different amount. */
  expectedTotal: z.number().int().min(0).optional(),
  payment: z.object({ type: z.literal("card"), card: cardSchema }),
});

export const confirmPaymentSchema = z.object({
  orderNumber: z.string().trim().min(3, "required").max(32, "too_long"),
  actionToken: z.string().trim().min(1, "required").max(2000, "too_long"),
  approved: z.boolean(),
  /** Order access token from the placeOrder result; signed-in customers can omit it. */
  accessToken: z.string().trim().max(200).optional(),
});

export interface PaymentOutcome {
  status: "succeeded" | "requires_action";
  orderNumber: string;
  accessToken: string;
  /** Present when `status` is `requires_action`. */
  actionToken?: string;
}

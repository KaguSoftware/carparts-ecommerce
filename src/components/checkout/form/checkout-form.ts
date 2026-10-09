import { z } from "zod";
import { regionOptions } from "@/components/account/forms/regions";
import { addressInputSchema, emailSchema } from "@/lib/validation/common";
import type { Address, AddressInput } from "@/lib/types/domain";
import { cvcValid, digitsOnly, expiryValid, luhnValid } from "./card-utils";

/**
 * Form model of the single-page checkout. Validation here is only for instant feedback; the server re-validates
 * everything (`placeOrderSchema`) and recomputes every amount.
 */

const addressFields = addressInputSchema.omit({ label: true });

const baseCheckoutObject = z.object({
    email: z.string().trim(),
    newsletterOptIn: z.boolean(),
    savedAddressId: z.string(),
    saveAddress: z.boolean(),
    shipping: z.object({
      firstName: z.string(),
      lastName: z.string(),
      company: z.string(),
      line1: z.string(),
      line2: z.string(),
      city: z.string(),
      region: z.string(),
      postalCode: z.string(),
      country: z.string(),
      phone: z.string(),
    }),
    billingSameAsShipping: z.boolean(),
    billing: z.object({
      firstName: z.string(),
      lastName: z.string(),
      company: z.string(),
      line1: z.string(),
      line2: z.string(),
      city: z.string(),
      region: z.string(),
      postalCode: z.string(),
      country: z.string(),
      phone: z.string(),
    }),
    shippingMethodId: z.string().min(1, "select_required"),
    card: z.object({
      number: z.string(),
      expiry: z.string(),
      cvc: z.string(),
      holder: z.string(),
    }),
    customerNote: z.string().max(500, "too_long"),
    acceptTerms: z.boolean().refine((v) => v === true, "terms_required"),
});

/** `isGuest`: signed-out visitors must also give a valid email; customers use their account email. */
export function createCheckoutSchema(isGuest: boolean) {
  return baseCheckoutObject.superRefine((value, ctx) => {
    const add = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });

    const checkAddress = (prefix: "shipping" | "billing") => {
      const address = value[prefix];
      const parsed = addressFields.safeParse(address);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) add([prefix, ...issue.path.map(String)], /^[a-z][a-z0-9_]*$/.test(issue.message) ? issue.message : "required");
      }
      if (regionOptions(address.country) && !address.region.trim()) add([prefix, "region"], "required");
    };
    checkAddress("shipping");
    if (!value.billingSameAsShipping) checkAddress("billing");

    const number = digitsOnly(value.card.number);
    if (!luhnValid(number)) add(["card", "number"], "card_number_invalid");
    if (!expiryValid(value.card.expiry)) add(["card", "expiry"], "card_expiry_invalid");
    if (!cvcValid(value.card.cvc, number)) add(["card", "cvc"], "card_cvc_invalid");
    if (value.card.holder.trim().length < 2) add(["card", "holder"], "required");
    if (isGuest) {
      const emailIssue = validateGuestEmail(value.email);
      if (emailIssue) add(["email"], emailIssue);
    }
  });
}

export type CheckoutFormValues = z.input<typeof baseCheckoutObject>;

function validateGuestEmail(email: string): string | null {
  const parsed = emailSchema.safeParse(email);
  return parsed.success ? null : (parsed.error.issues[0]?.message ?? "email_invalid");
}

export const EMPTY_ADDRESS: CheckoutFormValues["shipping"] = {
  firstName: "",
  lastName: "",
  company: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
  phone: "",
};

export function addressToFormValues(address: Address | AddressInput): CheckoutFormValues["shipping"] {
  return {
    firstName: address.firstName,
    lastName: address.lastName,
    company: address.company ?? "",
    line1: address.line1,
    line2: address.line2 ?? "",
    city: address.city,
    region: address.region,
    postalCode: address.postalCode,
    country: address.country,
    phone: address.phone,
  };
}

/** Drops empty optional fields so the stored order address stays tidy. */
export function toAddressInput(values: CheckoutFormValues["shipping"]): AddressInput {
  const address: AddressInput = {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    line1: values.line1.trim(),
    city: values.city.trim(),
    region: values.region.trim(),
    postalCode: values.postalCode.trim(),
    country: values.country.trim().toUpperCase(),
    phone: values.phone.trim(),
  };
  if (values.company.trim()) address.company = values.company.trim();
  if (values.line2.trim()) address.line2 = values.line2.trim();
  return address;
}

/**
 * Maps a server field path to a form field. Server keys: `email`, `shippingAddress.postalCode`, `billingAddress.*`,
 * `payment.card.number|expiry|expMonth|expYear|cvc|holder`, `shippingMethodId`, `customerNote`, `acceptTerms`.
 */
export function mapServerFieldToForm(key: string): string | null {
  if (key === "email" || key === "customerNote" || key === "acceptTerms" || key === "shippingMethodId") return key;
  if (key.startsWith("shippingAddress.")) return `shipping.${key.slice("shippingAddress.".length)}`;
  if (key.startsWith("billingAddress.")) return `billing.${key.slice("billingAddress.".length)}`;
  if (key.startsWith("payment.card.")) {
    const field = key.slice("payment.card.".length);
    if (field === "expMonth" || field === "expYear" || field === "expiry") return "card.expiry";
    return `card.${field}`;
  }
  return null;
}

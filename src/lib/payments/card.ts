import "server-only";

/**
 * Card input helpers shared by checkout validation and providers. Raw card data is only ever held in memory for
 * the duration of a charge call: we persist brand, last4 and expiry, never the number or CVC.
 */

export type CardBrand = "visa" | "mastercard" | "amex" | "discover" | "diners" | "jcb" | "unionpay" | "card";

export function digitsOnly(value: string): string {
  return value.replace(/[\s-]/g, "");
}

export function luhnValid(number: string): boolean {
  if (!/^\d{12,19}$/.test(number)) return false;
  let sum = 0;
  let double = false;
  for (let i = number.length - 1; i >= 0; i--) {
    let d = number.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

export function detectBrand(number: string): CardBrand {
  if (/^4/.test(number)) return "visa";
  if (/^(5[1-5]|2(2[2-9][1-9]|2[3-9]\d|[3-6]\d\d|7[01]\d|720))/.test(number)) return "mastercard";
  if (/^3[47]/.test(number)) return "amex";
  if (/^(6011|65|64[4-9])/.test(number)) return "discover";
  if (/^3(0[0-5]|[68])/.test(number)) return "diners";
  if (/^35(2[89]|[3-8])/.test(number)) return "jcb";
  if (/^62/.test(number)) return "unionpay";
  return "card";
}

export interface CardInput {
  number: string;
  expMonth: number;
  expYear: number;
  cvc: string;
  holder: string;
}

/**
 * Validates card fields. Returns field errors keyed by field name with validation codes
 * (`card_number_invalid`, `card_expiry_invalid`, `card_cvc_invalid`, `required`).
 */
export function validateCard(card: CardInput, now: Date = new Date()): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  const number = digitsOnly(card.number ?? "");
  if (!luhnValid(number)) errors.number = ["card_number_invalid"];

  const month = Number(card.expMonth);
  const year = Number(card.expYear) < 100 ? 2000 + Number(card.expYear) : Number(card.expYear);
  const expiryOk =
    Number.isInteger(month) && month >= 1 && month <= 12 && Number.isInteger(year) && year <= now.getUTCFullYear() + 25 &&
    (year > now.getUTCFullYear() || (year === now.getUTCFullYear() && month >= now.getUTCMonth() + 1));
  if (!expiryOk) errors.expiry = ["card_expiry_invalid"];

  const cvcLength = detectBrand(number) === "amex" ? 4 : 3;
  if (!new RegExp(`^\\d{${cvcLength}}$`).test(card.cvc ?? "")) errors.cvc = ["card_cvc_invalid"];

  if (!card.holder || card.holder.trim().length < 2) errors.holder = ["required"];
  return errors;
}

export function normalizeExpiryYear(year: number): number {
  return year < 100 ? 2000 + year : year;
}

/**
 * Client-side card helpers: formatting while typing and the same checks the server runs (Luhn, future expiry, CVC length).
 * The server stays authoritative (`validateCard` in src/lib/payments/card.ts); these only give instant feedback.
 * Raw card data never leaves the browser except in the one placeOrder request.
 */

export type CardBrand = "visa" | "mastercard" | "amex" | "discover" | "diners" | "jcb" | "unionpay" | "card";

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
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

/** "4242424242424242" -> "4242 4242 4242 4242" (American Express uses 4-6-5). */
export function formatCardNumber(raw: string): string {
  const digits = digitsOnly(raw).slice(0, 19);
  if (detectBrand(digits) === "amex") {
    return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)].filter(Boolean).join(" ");
  }
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** "1228" -> "12 / 28"; a leading 2-9 becomes "0x". Deleting the separator works naturally. */
export function formatExpiry(raw: string, previous = ""): string {
  let digits = digitsOnly(raw).slice(0, 4);
  if (digits.length === 1 && /[2-9]/.test(digits)) digits = `0${digits}`;
  if (digits.length < 2) return digits;
  // Backspacing over the " / " separator should not re-insert it.
  if (previous.endsWith(" / ") && raw.length < previous.length && digits.length === 2) return digits.slice(0, 1);
  return `${digits.slice(0, 2)} / ${digits.slice(2)}`;
}

export function parseExpiry(value: string): { month: number; year: number } | null {
  const match = /^\s*(\d{2})\s*\/\s*(\d{2}|\d{4})\s*$/.exec(value);
  if (!match) return null;
  const month = Number(match[1]);
  const rawYear = Number(match[2]);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  if (month < 1 || month > 12) return null;
  return { month, year };
}

export function expiryValid(value: string, now: Date = new Date()): boolean {
  const parsed = parseExpiry(value);
  if (!parsed) return false;
  const thisYear = now.getUTCFullYear();
  if (parsed.year > thisYear + 25) return false;
  return parsed.year > thisYear || (parsed.year === thisYear && parsed.month >= now.getUTCMonth() + 1);
}

export function cvcValid(cvc: string, number: string): boolean {
  const length = detectBrand(digitsOnly(number)) === "amex" ? 4 : 3;
  return new RegExp(`^\\d{${length}}$`).test(cvc);
}

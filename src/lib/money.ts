import type { Locale } from "@/i18n/routing";

/**
 * Money rules (binding, see ARCHITECTURE.md > Money):
 *  - All stored amounts are INTEGERS in USD minor units (cents). Never floats.
 *  - Display currency follows the locale: en -> USD, tr -> TRY (settings.currency.tryPerUsd).
 *  - Convert only at the presentation edge (and when snapshotting an order's charged amount).
 */
export type Currency = "USD" | "TRY";

export const BASE_CURRENCY: Currency = "USD";

/** Display currency + conversion rate (units of `currency` per 1 USD). USD => rate 1. */
export interface CurrencyContext {
  currency: Currency;
  /** Units of `currency` (major) per 1 USD (major). */
  rate: number;
}

export const USD_CONTEXT: CurrencyContext = { currency: "USD", rate: 1 };

export function currencyForLocale(locale: Locale | string): Currency {
  return locale === "tr" ? "TRY" : "USD";
}

export function currencyContextFor(locale: Locale | string, tryPerUsd: number): CurrencyContext {
  const currency = currencyForLocale(locale);
  return { currency, rate: currency === "USD" ? 1 : tryPerUsd };
}

const INTL_LOCALE: Record<string, string> = { en: "en-US", tr: "tr-TR" };

/** Convert USD minor units to display-currency minor units (both are 2-decimal currencies). */
export function convertFromBase(usdMinor: number, ctx: CurrencyContext): number {
  return Math.round(usdMinor * ctx.rate);
}

/** Convert display-currency minor units back to USD minor units. */
export function convertToBase(displayMinor: number, ctx: CurrencyContext): number {
  return Math.round(displayMinor / ctx.rate);
}

/** Format an amount that is ALREADY in `currency` minor units. */
export function formatMinor(minor: number, currency: Currency, locale: Locale | string): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale] ?? "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

/** Format a USD-base amount for display in the locale's currency. THE helper UI code should use. */
export function formatMoney(usdMinor: number, locale: Locale | string, ctx: CurrencyContext = USD_CONTEXT): string {
  return formatMinor(convertFromBase(usdMinor, ctx), ctx.currency, locale);
}

/** Parse a user-typed decimal ("12.5", "12,50", "1,299.00") into integer minor units. NaN on bad input. */
export function parseMajorToMinor(input: string): number {
  const s = input.trim().replace(/\s/g, "");
  if (!s) return NaN;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let normalized = s;
  if (lastComma > -1 && lastDot > -1) {
    normalized = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma > -1) {
    normalized = /,\d{1,2}$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return NaN;
  return Math.round(parseFloat(normalized) * 100);
}

/** Minor units -> plain decimal string for form inputs ("1299.00"). */
export function minorToMajorString(minor: number): string {
  return (minor / 100).toFixed(2);
}

/** Basis points (1 bp = 0.01%) applied to an amount, rounded half away from zero. */
export function applyBps(amountMinor: number, bps: number): number {
  const v = (amountMinor * bps) / 10_000;
  return Math.sign(v) * Math.round(Math.abs(v));
}

/** Percentage (0-100, may be fractional) of an amount, rounded half away from zero. */
export function percentOf(amountMinor: number, percent: number): number {
  return applyBps(amountMinor, Math.round(percent * 100));
}

/**
 * Split `total` across `weights` with no lost cents (largest remainder). Used to distribute
 * order-level discounts over line items.
 */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const out = raw.map(Math.floor);
  let remainder = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (remainder <= 0) break;
    out[i] = (out[i] ?? 0) + 1;
    remainder -= 1;
  }
  return out;
}

export function discountPercent(priceMinor: number, compareAtMinor: number): number {
  if (compareAtMinor <= priceMinor || compareAtMinor <= 0) return 0;
  return Math.round(((compareAtMinor - priceMinor) / compareAtMinor) * 100);
}

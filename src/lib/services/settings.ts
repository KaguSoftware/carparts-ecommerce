import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { DomainError, notFound } from "@/lib/errors";
import { currencyContextFor, type CurrencyContext } from "@/lib/money";
import type { Locale } from "@/i18n/routing";
import type { Actor, PublicSettings, StoreSettings } from "@/lib/types/domain";
import type { DeepPartial } from "./contracts";
import { logAudit } from "./audit";
import { nowIso } from "./_shared";
import { zodFieldErrors } from "@/lib/action-result";

const SETTINGS_ID = "settings";

export async function getSettings(): Promise<StoreSettings> {
  const row = await db.settings.get(SETTINGS_ID);
  if (!row) throw notFound("settings");
  return row;
}

export async function getPublicSettings(): Promise<PublicSettings> {
  const s = await getSettings();
  return {
    store: { name: s.store.name, email: s.store.email, phone: s.store.phone, address: s.store.address },
    tryPerUsd: s.currency.tryPerUsd,
    guestCheckout: s.checkout.guestCheckout,
    freeShippingThreshold: s.checkout.freeShippingThreshold,
    maxQuantityPerLine: s.checkout.maxQuantityPerLine,
    shippableCountries: s.checkout.shippableCountries,
    defaultCountry: s.checkout.defaultCountry,
    social: s.social,
    maintenanceMode: s.maintenanceMode,
  };
}

export async function getCurrencyContext(locale: Locale): Promise<CurrencyContext> {
  const s = await getSettings();
  return currencyContextFor(locale, s.currency.tryPerUsd);
}

const localized = z.object({ en: z.string().trim().max(500, "too_long"), tr: z.string().trim().max(500, "too_long") });
const country = z.string().trim().length(2, "country_invalid").toUpperCase();
const optionalUrl = z.string().trim().max(300, "too_long").refine((v) => v === "" || /^https?:\/\//i.test(v), "url_invalid").optional();

const settingsSchema = z.object({
  store: z.object({
    name: z.string().trim().min(1, "required").max(80, "too_long"),
    legalEntity: z.string().trim().max(120, "too_long"),
    email: z.string().trim().email("email_invalid").max(254, "too_long"),
    phone: z.string().trim().max(40, "too_long"),
    address: z.object({
      line1: z.string().trim().max(120, "too_long"),
      city: z.string().trim().max(80, "too_long"),
      region: z.string().trim().max(80, "too_long"),
      postalCode: z.string().trim().max(20, "too_long"),
      country,
    }),
    taxId: z.string().trim().max(40, "too_long").optional(),
  }),
  currency: z.object({
    base: z.literal("USD"),
    tryPerUsd: z.number({ error: "number_invalid" }).positive("must_be_positive").max(10_000, "too_large"),
  }),
  checkout: z.object({
    guestCheckout: z.boolean(),
    orderNumberPrefix: z.string().trim().regex(/^[A-Za-z0-9-]{0,8}$/, "invalid_value"),
    nextOrderNumber: z.number().int().positive(),
    maxQuantityPerLine: z.number({ error: "number_invalid" }).int("integer_required").min(1, "must_be_positive").max(100, "too_large"),
    freeShippingThreshold: z.number({ error: "number_invalid" }).int("integer_required").min(0, "must_not_be_negative").max(100_000_000, "too_large"),
    defaultCountry: country,
    shippableCountries: z.array(country).min(1, "required").max(250),
    reservationMinutes: z.number({ error: "number_invalid" }).int("integer_required").min(5, "invalid_value").max(1440, "too_large"),
  }),
  inventory: z.object({
    defaultLowStockThreshold: z.number({ error: "number_invalid" }).int("integer_required").min(0, "must_not_be_negative").max(10_000, "too_large"),
    allowBackorders: z.boolean(),
  }),
  seo: z.object({ defaultTitle: localized, defaultDescription: localized }),
  social: z.object({ instagram: optionalUrl, youtube: optionalUrl, x: optionalUrl, facebook: optionalUrl }),
  maintenanceMode: z.boolean(),
  emails: z.object({
    orderConfirmation: z.boolean(),
    shippingUpdate: z.boolean(),
    adminNewOrder: z.boolean(),
    adminAddress: z.string().trim().max(254, "too_long").refine((v) => v === "" || z.string().email().safeParse(v).success, "email_invalid"),
  }),
});

const PROTECTED_KEYS = new Set(["id", "createdAt", "updatedAt"]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) return (patch === undefined ? base : patch) as T;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    out[key] = isPlainObject(value) && isPlainObject(out[key]) ? deepMerge(out[key], value) : value;
  }
  return out as T;
}

/** Flatten to dot paths for the audit diff. */
function flatten(value: unknown, prefix = "", out: Record<string, unknown> = {}): Record<string, unknown> {
  if (isPlainObject(value)) {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else {
    out[prefix] = value;
  }
  return out;
}

export async function updateSettings(
  patch: DeepPartial<Omit<StoreSettings, "id" | "createdAt" | "updatedAt" | "checkout"> & { checkout: Omit<StoreSettings["checkout"], "nextOrderNumber"> }>,
  actor: Actor,
): Promise<StoreSettings> {
  return db.transaction(async () => {
    const current = await getSettings();
    const cleanPatch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch as Record<string, unknown>)) if (!PROTECTED_KEYS.has(k)) cleanPatch[k] = v;
    // The order counter is owned by allocateOrderNumber.
    if (isPlainObject(cleanPatch.checkout)) delete (cleanPatch.checkout as Record<string, unknown>).nextOrderNumber;

    const merged = deepMerge(current, cleanPatch);
    const parsed = settingsSchema.safeParse(merged);
    if (!parsed.success) throw new DomainError("validation_failed", { fieldErrors: zodFieldErrors(parsed.error) });
    if (!parsed.data.checkout.shippableCountries.includes(parsed.data.checkout.defaultCountry)) {
      throw new DomainError("validation_failed", { fieldErrors: { "checkout.defaultCountry": ["invalid_value"] } });
    }

    const next: StoreSettings = { ...current, ...parsed.data, id: SETTINGS_ID, createdAt: current.createdAt, updatedAt: nowIso() } as StoreSettings;
    // `social` entries emptied in the form are removed
    for (const key of Object.keys(next.social) as (keyof StoreSettings["social"])[]) if (!next.social[key]) delete next.social[key];
    const saved = await db.settings.upsert(next);

    const before = flatten({ ...current, createdAt: undefined, updatedAt: undefined });
    const after = flatten({ ...saved, createdAt: undefined, updatedAt: undefined });
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        const f = before[key];
        const t = after[key];
        changes[key] = { from: typeof f === "string" && f.length > 120 ? f.slice(0, 117) + "..." : f, to: typeof t === "string" && t.length > 120 ? t.slice(0, 117) + "..." : t };
      }
    }
    if (Object.keys(changes).length) {
      await logAudit({ actor, action: "settings.update", entityType: "settings", entityId: SETTINGS_ID, summary: `Updated ${Object.keys(changes).length} setting(s)`, changes });
    }
    return saved;
  });
}

export async function allocateOrderNumber(): Promise<string> {
  return db.transaction(async () => {
    const settings = await getSettings();
    let n = settings.checkout.nextOrderNumber;
    const prefix = settings.checkout.orderNumberPrefix;
    // Guard against a counter that fell behind existing orders (restored backup, manual edits).
    while (await db.orders.findOne((o) => o.number === `${prefix}${n}`)) n++;
    await db.settings.update(SETTINGS_ID, { checkout: { ...settings.checkout, nextOrderNumber: n + 1 }, updatedAt: nowIso() });
    return `${prefix}${n}`;
  });
}

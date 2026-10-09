import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { env, siteUrl } from "@/lib/env";
import { ADMIN_LOCALE_COOKIE, DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/routing";
import type { Id, VehicleSelection } from "@/lib/types/domain";

/**
 * Cookie helpers (ARCHITECTURE.md > Cookies). All httpOnly + SameSite=Lax (+ Secure when the site is served
 * over https). The cart id is HMAC-signed so a forged cookie can never address someone else's cart.
 * Setters only work in Server Actions / Route Handlers (Next restriction).
 */

export const CART_COOKIE = "cart_id";
export const VEHICLE_COOKIE = "vehicle";

const DAY = 60 * 60 * 24;
const secure = () => siteUrl().startsWith("https://");

const baseOptions = () => ({ httpOnly: true, sameSite: "lax" as const, secure: secure(), path: "/" });

/* ---- signing ---- */

function signature(value: string): string {
  return createHmac("sha256", env.BETTER_AUTH_SECRET).update(`cart:${value}`).digest("base64url").slice(0, 27);
}

export function signCartId(id: Id): string {
  return `${id}.${signature(id)}`;
}

export function verifyCartCookie(raw: string | undefined | null): Id | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = raw.slice(0, dot);
  const given = Buffer.from(raw.slice(dot + 1));
  const expected = Buffer.from(signature(id));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return id;
}

/* ---- cart ---- */

export async function getCartId(): Promise<Id | null> {
  return verifyCartCookie((await cookies()).get(CART_COOKIE)?.value);
}

export async function setCartId(id: Id): Promise<void> {
  (await cookies()).set(CART_COOKIE, signCartId(id), { ...baseOptions(), maxAge: 60 * DAY });
}

export async function clearCartId(): Promise<void> {
  (await cookies()).set(CART_COOKIE, "", { ...baseOptions(), maxAge: 0 });
}

/* ---- vehicle ---- */

const selectionSchema = z.strictObject({
  makeId: z.string().min(1).max(64).optional(),
  modelId: z.string().min(1).max(64).optional(),
  year: z.number().int().min(1950).max(2100).optional(),
  vehicleId: z.string().min(1).max(64).optional(),
});

export function parseVehicleSelection(raw: string | undefined | null): VehicleSelection {
  if (!raw) return {};
  try {
    const parsed = selectionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export async function getVehicleSelection(): Promise<VehicleSelection> {
  return parseVehicleSelection((await cookies()).get(VEHICLE_COOKIE)?.value);
}

export async function setVehicleSelection(selection: VehicleSelection): Promise<void> {
  const clean = selectionSchema.parse(selection);
  (await cookies()).set(VEHICLE_COOKIE, JSON.stringify(clean), { ...baseOptions(), maxAge: 365 * DAY });
}

export async function clearVehicleSelection(): Promise<void> {
  (await cookies()).set(VEHICLE_COOKIE, "", { ...baseOptions(), maxAge: 0 });
}

/* ---- admin locale ---- */

export async function getAdminLocale(): Promise<Locale> {
  const value = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function setAdminLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(ADMIN_LOCALE_COOKIE, locale, { ...baseOptions(), maxAge: 365 * DAY });
}

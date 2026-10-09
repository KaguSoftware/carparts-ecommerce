import "server-only";
import { headers } from "next/headers";
import { isAPIError } from "better-auth/api";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { siteUrl } from "@/lib/env";
import { getCartId, setCartId } from "@/lib/session/cookies";
import { mergeGuestCart } from "@/lib/services/cart";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import type { Id, SessionUser } from "@/lib/types/domain";
import { emailSchema, localeSchema, passwordSchema } from "@/lib/validation/common";
import type { Locale } from "@/i18n/routing";
import { getAuth } from "./auth";
import { getSessionUser } from "./session";

/**
 * Credential flows for Server Actions (`@/actions/account/auth`, `@/actions/admin/auth`). They wrap Better Auth's
 * server API with: rate limiting, password policy, DomainError mapping (no user enumeration) and the guest-cart merge.
 * Cookies are written by the `nextCookies()` plugin, so these must run inside a Server Action / Route Handler.
 */

const ERROR_CODES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "invalid_credentials",
  ACCOUNT_LOCKED: "account_locked",
  ACCOUNT_DISABLED: "account_disabled",
  USER_ALREADY_EXISTS: "email_taken",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "email_taken",
  PASSWORD_TOO_SHORT: "weak_password",
  PASSWORD_TOO_LONG: "weak_password",
  INVALID_PASSWORD: "password_incorrect",
  INVALID_TOKEN: "invalid_token",
  TOKEN_EXPIRED: "invalid_token",
};

/** Maps a Better Auth failure to our DomainError vocabulary. Anything unrecognised becomes `unknown`. */
export function toDomainError(error: unknown): DomainError {
  if (error instanceof DomainError) return error;
  if (isAPIError(error)) {
    const body = error.body as { code?: string; message?: string } | undefined;
    const code = (body?.code && ERROR_CODES[body.code]) || (body?.message && ERROR_CODES[body.message.toUpperCase().replace(/\s+/g, "_")]) || undefined;
    if (code) return new DomainError(code, { status: code === "account_locked" ? 429 : code === "invalid_credentials" ? 401 : 400 });
    if (body?.message === "account_locked") return new DomainError("account_locked", { status: 429 });
    if (body?.message === "account_disabled") return new DomainError("account_disabled", { status: 403 });
    if (error.statusCode === 429) return new DomainError("rate_limited", { status: 429 });
    if (error.statusCode === 401 || error.statusCode === 403) return new DomainError("invalid_credentials", { status: 401 });
  }
  return new DomainError("unknown", { status: 500 });
}

async function toSessionUser(raw: unknown): Promise<SessionUser> {
  const u = raw as { id: string; email: string; name: string; role?: string; locale?: string; image?: string | null };
  return { id: u.id, email: u.email, name: u.name, role: u.role === "admin" || u.role === "staff" ? u.role : "customer", locale: u.locale === "tr" ? "tr" : "en", image: u.image ?? null };
}

/** Moves the guest cart (cookie) into the signed-in user's cart and points the cookie at the result. */
export async function mergeCartAfterSignIn(userId: Id): Promise<void> {
  try {
    const guestCartId = await getCartId();
    const cart = await mergeGuestCart(guestCartId ?? "", userId);
    await setCartId(cart.id);
  } catch {
    // The cart is a convenience: never block a sign-in because of it.
  }
}

export async function signInWithPassword(input: { email: string; password: string }): Promise<SessionUser> {
  const email = emailSchema.safeParse(input.email);
  if (!email.success || !input.password) throw new DomainError("invalid_credentials", { status: 401 });
  await enforceRateLimit("sign-in", { limit: 30, windowMs: 10 * 60_000, discriminator: email.data });
  await enforceRateLimit("sign-in-global", { limit: 600, windowMs: 10 * 60_000, ip: "all" });
  try {
    const result = await getAuth().api.signInEmail({ body: { email: email.data, password: input.password }, headers: await headers() });
    const user = await toSessionUser(result.user);
    await mergeCartAfterSignIn(user.id);
    return user;
  } catch (error) {
    throw toDomainError(error);
  }
}

/** Where Better Auth sends the browser after the e-mail link is opened (the storefront's /verify-email page). */
function verificationCallbackUrl(locale: Locale): string {
  return `${siteUrl()}/${locale}/verify-email?status=verified`;
}

export async function signUpWithPassword(input: { name: string; email: string; password: string; locale: Locale; marketingOptIn?: boolean }): Promise<SessionUser> {
  const email = emailSchema.safeParse(input.email);
  const password = passwordSchema.safeParse(input.password);
  const locale = localeSchema.safeParse(input.locale);
  const name = input.name?.trim();
  const fieldErrors: Record<string, string[]> = {};
  if (!email.success) fieldErrors.email = [email.error.issues[0]?.message ?? "email_invalid"];
  if (!password.success) fieldErrors.password = [password.error.issues[0]?.message ?? "weak_password"];
  if (!locale.success) fieldErrors.locale = ["invalid_value"];
  if (!name || name.length > 80) fieldErrors.name = [name ? "too_long" : "required"];
  if (Object.keys(fieldErrors).length) throw new DomainError("validation_failed", { fieldErrors });
  await enforceRateLimit("sign-up", { limit: 10, windowMs: 60 * 60_000 });
  try {
    const result = await getAuth().api.signUpEmail({
      body: { name: name as string, email: (email as { data: string }).data, password: input.password, locale: (locale as { data: Locale }).data, marketingOptIn: Boolean(input.marketingOptIn), callbackURL: verificationCallbackUrl((locale as { data: Locale }).data) },
      headers: await headers(),
    });
    const user = await toSessionUser(result.user);
    await mergeCartAfterSignIn(user.id);
    return user;
  } catch (error) {
    throw toDomainError(error);
  }
}

/** Sends a fresh verification link to the signed-in user (rate limited per account). */
export async function resendVerificationEmail(locale: Locale): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new DomainError("unauthorized", { status: 401 });
  await enforceRateLimit("verify-resend", { limit: 3, windowMs: 15 * 60_000, discriminator: user.id });
  try {
    await getAuth().api.sendVerificationEmail({ body: { email: user.email, callbackURL: verificationCallbackUrl(locale) }, headers: await headers() });
  } catch (error) {
    throw toDomainError(error);
  }
}

export async function signOutCurrentUser(): Promise<void> {
  try {
    await getAuth().api.signOut({ headers: await headers() });
  } catch {
    // already signed out
  }
}

/** Always resolves (no account enumeration): unknown emails get the same response as known ones. */
export async function requestPasswordReset(input: { email: string; locale: Locale }): Promise<void> {
  const email = emailSchema.safeParse(input.email);
  if (!email.success) throw new DomainError("validation_failed", { fieldErrors: { email: ["email_invalid"] } });
  await enforceRateLimit("password-reset", { limit: 5, windowMs: 15 * 60_000, discriminator: email.data });
  try {
    await getAuth().api.requestPasswordReset({ body: { email: email.data, redirectTo: `${siteUrl()}/${input.locale}/reset-password` }, headers: await headers() });
  } catch (error) {
    const mapped = toDomainError(error);
    if (mapped.code === "rate_limited") throw mapped;
    // anything else is swallowed on purpose
  }
}

export async function resetPasswordWithToken(input: { token: string; newPassword: string }): Promise<void> {
  const password = passwordSchema.safeParse(input.newPassword);
  if (!password.success) throw new DomainError("validation_failed", { fieldErrors: { newPassword: [password.error.issues[0]?.message ?? "weak_password"] } });
  if (!input.token) throw new DomainError("invalid_token", { status: 400 });
  await enforceRateLimit("password-reset-confirm", { limit: 10, windowMs: 15 * 60_000 });
  try {
    await getAuth().api.resetPassword({ body: { token: input.token, newPassword: input.newPassword } });
    // new password: clear any lockout for this account's sessions is not needed; sessions were revoked by Better Auth
  } catch (error) {
    throw toDomainError(error);
  }
}

export async function changePasswordForCurrentUser(input: { currentPassword: string; newPassword: string }): Promise<void> {
  const password = passwordSchema.safeParse(input.newPassword);
  if (!password.success) throw new DomainError("validation_failed", { fieldErrors: { newPassword: [password.error.issues[0]?.message ?? "weak_password"] } });
  await enforceRateLimit("change-password", { limit: 10, windowMs: 15 * 60_000 });
  try {
    await getAuth().api.changePassword({ body: { currentPassword: input.currentPassword, newPassword: input.newPassword, revokeOtherSessions: true }, headers: await headers() });
  } catch (error) {
    throw toDomainError(error);
  }
}

/** Admin panel sign-in: same flow, but only staff/admin accounts may proceed (a customer session is revoked at once). */
export async function signInStaff(input: { email: string; password: string }): Promise<SessionUser> {
  const user = await signInWithPassword(input);
  if (user.role === "customer") {
    await signOutCurrentUser();
    throw new DomainError("forbidden", { status: 403 });
  }
  return user;
}

/** Revoke every session of a user (disable, role change, delete). */
export async function revokeUserSessions(userId: Id): Promise<number> {
  return db.authSessions.deleteWhere((s) => s.userId === userId);
}

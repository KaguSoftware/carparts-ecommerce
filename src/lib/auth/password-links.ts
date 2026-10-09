import "server-only";
import { db, createToken } from "@/lib/db";
import { env, siteUrl } from "@/lib/env";
import type { Id } from "@/lib/types/domain";
import type { Locale } from "@/i18n/routing";

/**
 * Creates a "set your password" link outside the Better Auth request flow (staff invitations, admin-triggered
 * resets). It writes the same verification row Better Auth's own `requestPasswordReset` would, so the standard
 * /reset-password page (`resetPassword({ token, newPassword })`) accepts it.
 */
export async function createPasswordSetupUrl(userId: Id, opts: { locale: Locale; ttlSeconds?: number }): Promise<string> {
  const token = createToken(18);
  const now = Date.now();
  const at = new Date(now).toISOString();
  await db.authVerifications.insert({
    identifier: `reset-password:${token}`,
    value: userId,
    expiresAt: new Date(now + (opts.ttlSeconds ?? 60 * 60 * 24 * 3) * 1000).toISOString(),
    createdAt: at,
    updatedAt: at,
  });
  const base = (env.BETTER_AUTH_URL ?? siteUrl()).replace(/\/+$/, "");
  return `${base}/api/auth/reset-password/${token}?callbackURL=${encodeURIComponent(`${siteUrl()}/${opts.locale}/reset-password`)}`;
}

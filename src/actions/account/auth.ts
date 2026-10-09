"use server";

import { runAction, type ActionResult } from "@/lib/action-result";
import { assertUser } from "@/lib/auth/session";
import {
  changePasswordForCurrentUser,
  requestPasswordReset,
  resendVerificationEmail,
  resetPasswordWithToken,
  signInWithPassword,
  signOutCurrentUser,
  signUpWithPassword,
} from "@/lib/auth/credentials";
import { revalidateAccount, revalidateStore } from "@/lib/cache";
import { redirect } from "@/i18n/navigation";
import { safeNextPath } from "./next-path";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  localeOnlySchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "./auth.schema";

/**
 * Credential flows (ARCHITECTURE.md 7.3). The heavy lifting - rate limiting, lockout, password policy, guest-cart merge,
 * no user enumeration - lives in `@/lib/auth/credentials`; these actions validate input and shape the result.
 */

export async function signInAction(raw: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(signInSchema, raw, async (input) => {
    await signInWithPassword({ email: input.email, password: input.password });
    revalidateStore();
    return { redirectTo: safeNextPath(input.next) ?? "/account" };
  });
}

export async function signUpAction(raw: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(signUpSchema, raw, async (input) => {
    await signUpWithPassword({ name: input.name, email: input.email, password: input.password, locale: input.locale, marketingOptIn: input.marketingOptIn });
    revalidateStore();
    const next = safeNextPath(input.next);
    return { redirectTo: next ? `/verify-email?status=sent&next=${encodeURIComponent(next)}` : "/verify-email?status=sent" };
  });
}

export async function signOutAction(raw: unknown): Promise<ActionResult> {
  return runAction(localeOnlySchema, raw, async ({ locale }) => {
    await signOutCurrentUser();
    revalidateStore();
    redirect({ href: "/", locale });
  });
}

/** Always succeeds for well-formed emails (no account enumeration). */
export async function requestPasswordResetAction(raw: unknown): Promise<ActionResult> {
  return runAction(forgotPasswordSchema, raw, async ({ email, locale }) => {
    await requestPasswordReset({ email, locale });
  });
}

export async function resetPasswordAction(raw: unknown): Promise<ActionResult> {
  return runAction(resetPasswordSchema, raw, async ({ token, newPassword }) => {
    await resetPasswordWithToken({ token, newPassword });
  });
}

export async function changePasswordAction(raw: unknown): Promise<ActionResult> {
  return runAction(changePasswordSchema, raw, async ({ currentPassword, newPassword }) => {
    await assertUser();
    await changePasswordForCurrentUser({ currentPassword, newPassword });
    revalidateAccount();
  });
}

export async function resendVerificationAction(raw: unknown): Promise<ActionResult> {
  return runAction(localeOnlySchema, raw, async ({ locale }) => {
    await assertUser();
    await resendVerificationEmail(locale);
  });
}

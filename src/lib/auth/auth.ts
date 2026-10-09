import "server-only";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { z } from "zod";
import { brand } from "@/config/brand";
import { createId, db } from "@/lib/db";
import { sendPasswordReset, sendVerifyEmail, sendWelcome } from "@/lib/email";
import { env, siteUrl } from "@/lib/env";
import { logger } from "@/lib/logger";
import { assertNotLocked, lockoutKey, registerLoginFailure, registerLoginSuccess } from "@/lib/security/lockout";
import { getClientIp } from "@/lib/security/ip";
import { isDomainError } from "@/lib/errors";
import type { Locale } from "@/i18n/routing";
import { jsonFileAdapter } from "./json-adapter";

/**
 * Better Auth instance (ARCHITECTURE.md > Auth).
 *  - email + password only, minimum 10 characters (complexity is enforced by our zod schemas at the edge)
 *  - sessions in the JSON store through `json-adapter.ts`; cookie cache OFF so role/disabled changes apply immediately
 *  - login lockout (5 failures / 10 min per email+IP) enforced here, so it also protects direct /api/auth calls
 *  - disabled accounts cannot create sessions
 *  - emails (verification, reset, welcome) go to the mail outbox
 *
 * Created lazily: importing this module never reads the environment (keeps `next build` secret-free).
 */

const SESSION_SECONDS = 60 * 60 * 24 * 14;
const SIGN_IN_PATH = "/sign-in/email";

const asLocale = (value: unknown): Locale => (value === "tr" ? "tr" : "en");

const ipOf = (ctx: { request?: Request; headers?: Headers }): string => getClientIp(ctx.request?.headers ?? ctx.headers ?? new Headers());

export function createAuth(opts: { cookies?: boolean } = {}) {
  const baseURL = env.BETTER_AUTH_URL ?? siteUrl();
  const plugins = [nextCookies()];
  if (opts.cookies === false) plugins.length = 0;

  return betterAuth({
    appName: brand.fullName,
    baseURL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [siteUrl(), baseURL],
    database: jsonFileAdapter(),

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      autoSignIn: true,
      requireEmailVerification: false,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendPasswordReset({ email: user.email, name: user.name, url, locale: asLocale((user as { locale?: unknown }).locale) });
      },
    },

    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user, url }) => {
        await sendVerifyEmail({ email: user.email, name: user.name, url, locale: asLocale((user as { locale?: unknown }).locale) });
      },
      afterEmailVerification: async (user) => {
        await sendWelcome({ email: user.email, name: user.name, locale: asLocale((user as { locale?: unknown }).locale) }).catch((error: unknown) => logger.warn("auth.welcome_failed", { error }));
      },
    },

    user: {
      modelName: "users",
      additionalFields: {
        // role is never writable from the client: only services/seed change it
        role: { type: "string", required: false, defaultValue: "customer", input: false },
        locale: { type: "string", required: false, defaultValue: "en", input: true, validator: { input: z.enum(["en", "tr"]) } },
        phone: { type: "string", required: false, input: true },
        disabled: { type: "boolean", required: false, defaultValue: false, input: false },
        marketingOptIn: { type: "boolean", required: false, defaultValue: false, input: true },
      },
    },
    session: {
      modelName: "authSessions",
      expiresIn: SESSION_SECONDS,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    account: { modelName: "authAccounts" },
    verification: { modelName: "authVerifications" },

    advanced: {
      database: { generateId: ({ model }) => createId(({ user: "usr", session: "ses", account: "acc", verification: "ver" } as Record<string, string>)[model] ?? "id") },
      useSecureCookies: baseURL.startsWith("https://"),
      ipAddress: { ipAddressHeaders: env.TRUST_PROXY ? ["x-forwarded-for", "x-real-ip"] : [] },
    },

    rateLimit: {
      // Without a trusted client IP Better Auth would use one shared key for everyone; our own limiter + lockout cover that case.
      enabled: env.NODE_ENV !== "test" && env.TRUST_PROXY,
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 300, max: 5 },
        "/reset-password": { window: 300, max: 10 },
      },
    },

    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const user = await db.users.get(String((session as { userId: unknown }).userId));
            if (user?.disabled) throw APIError.from("FORBIDDEN", { message: "account_disabled", code: "ACCOUNT_DISABLED" });
          },
          after: async (session) => {
            const userId = String((session as { userId: unknown }).userId);
            await db.users.update(userId, { lastLoginAt: new Date().toISOString() }).catch(() => undefined);
          },
        },
      },
    },

    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== SIGN_IN_PATH) return;
        const email = typeof (ctx.body as { email?: unknown } | undefined)?.email === "string" ? (ctx.body as { email: string }).email : "";
        if (!email) return;
        try {
          await assertNotLocked(lockoutKey(email, ipOf(ctx)));
        } catch (error) {
          if (isDomainError(error) && error.code === "account_locked") throw APIError.from("TOO_MANY_REQUESTS", { message: "account_locked", code: "ACCOUNT_LOCKED" });
          throw error;
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== SIGN_IN_PATH) return;
        const email = typeof (ctx.body as { email?: unknown } | undefined)?.email === "string" ? (ctx.body as { email: string }).email : "";
        if (!email) return;
        const key = lockoutKey(email, ipOf(ctx));
        const returned = (ctx.context as { returned?: unknown }).returned;
        if (isAPIError(returned)) {
          const code = (returned.body as { code?: string } | undefined)?.code;
          if (code === "INVALID_EMAIL_OR_PASSWORD") await registerLoginFailure(key);
        } else {
          await registerLoginSuccess(key);
        }
      }),
    },

    plugins,
  });
}

export type Auth = ReturnType<typeof createAuth>;

const KEY = Symbol.for("apexline.auth");
type G = typeof globalThis & { [KEY]?: Auth };

/** The shared instance (survives HMR through globalThis). */
export function getAuth(): Auth {
  const g = globalThis as G;
  return (g[KEY] ??= createAuth());
}

/** `auth.api.*` / `auth.handler` without touching the environment at import time. */
export const auth: Auth = new Proxy({} as Auth, {
  get(_target, prop) {
    return Reflect.get(getAuth(), prop);
  },
});

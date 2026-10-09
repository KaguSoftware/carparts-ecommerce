import "server-only";
import { z } from "zod";

/**
 * Validated environment (server-side). Import `env` instead of touching process.env directly.
 * Parsed lazily on first access so `next build` can run without secrets; in production the first
 * request fails fast with a readable message if something is missing.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters").default("dev-only-secret-dev-only-secret-0000"),
  BETTER_AUTH_URL: z.url().optional(),
  DATA_DIR: z.string().default("data/runtime"),
  UPLOAD_DIR: z.string().default("public/uploads"),
  /** Where the file outbox mailer writes emails. Defaults to a sibling `outbox` folder of DATA_DIR. */
  OUTBOX_DIR: z.string().optional(),
  /** Production only: set to "true" to seed the full demo data set WITH the publicly known demo passwords. */
  SEED_DEMO_DATA: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  /** Production first boot: administrator email / fixed password (random password is generated when omitted). */
  ADMIN_EMAIL: z.email().optional(),
  ADMIN_PASSWORD: z.string().min(12, "ADMIN_PASSWORD must be at least 12 characters").optional(),
  PAYMENT_PROVIDER: z.enum(["mock", "stripe"]).default("mock"),
  /** Artificial latency of the mock payment provider (ms). Always 0 under NODE_ENV=test. */
  MOCK_PAYMENT_LATENCY_MS: z.coerce.number().int().min(0).max(10_000).default(350),
  /** Shared secret that signs mock payment webhooks and 3-D-Secure style action tokens. */
  PAYMENT_WEBHOOK_SECRET: z.string().min(16).default("dev-only-webhook-secret-0000"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  EMAIL_PROVIDER: z.enum(["outbox"]).default("outbox"),
  EMAIL_FROM: z.string().default("APEXLINE Auto Parts <orders@apexline.example>"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Rejects placeholder/example secrets, short secrets and secrets with too little variety. */
function isStrongSecret(secret: string): boolean {
  if (secret.length < 32) return false;
  if (/change-me|dev-only|example|test/i.test(secret)) return false;
  return new Set(secret).size >= 10;
}

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  const value = parsed.data;
  if (value.NODE_ENV === "production") {
    if (!isStrongSecret(value.BETTER_AUTH_SECRET)) {
      throw new Error("BETTER_AUTH_SECRET must be set to a strong random value (32+ chars, no placeholder text) in production");
    }
    if (!isStrongSecret(value.PAYMENT_WEBHOOK_SECRET)) {
      throw new Error("PAYMENT_WEBHOOK_SECRET must be set to a strong random value (32+ chars, no placeholder text) in production");
    }
    if (value.PAYMENT_PROVIDER === "mock" && process.env.ALLOW_MOCK_PAYMENTS !== "true") {
      throw new Error("PAYMENT_PROVIDER=mock is not allowed in production (set ALLOW_MOCK_PAYMENTS=true to override for demos only)");
    }
  }
  if (value.NODE_ENV === "production") {
    if (process.env.TRUST_PROXY !== "true" && process.env.TRUST_PROXY !== "false") {
      throw new Error('TRUST_PROXY must be explicitly set to "true" (behind a proxy that overwrites X-Forwarded-For) or "false" in production');
    }
    const missing = ["BETTER_AUTH_URL", "NEXT_PUBLIC_APP_URL"].filter((k) => !process.env[k]);
    if (missing.length) throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
    if (value.PAYMENT_PROVIDER === "stripe" && (!value.STRIPE_SECRET_KEY || !value.STRIPE_WEBHOOK_SECRET)) {
      throw new Error("PAYMENT_PROVIDER=stripe requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET");
    }
  }
  return value;
}

export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string | symbol) {
    // Not config keys: lets `await`, console.log and bundlers touch the proxy without triggering validation.
    if (typeof prop === "symbol" || prop === "then") return undefined;
    cached ??= load();
    return cached[prop as keyof Env];
  },
});

/** Public origin without trailing slash, e.g. https://apexline.example */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

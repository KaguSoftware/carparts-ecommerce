import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** `env.ts` validates lazily; each case loads a fresh copy of the module with a controlled process.env. */
const KEYS = ["NODE_ENV", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "NEXT_PUBLIC_APP_URL", "PAYMENT_WEBHOOK_SECRET", "PAYMENT_PROVIDER", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "TRUST_PROXY", "ALLOW_MOCK_PAYMENTS", "LOG_LEVEL", "MOCK_PAYMENT_LATENCY_MS", "DATA_DIR"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  vi.resetModules();
});

afterEach(() => {
  for (const k of KEYS) {
    const env = process.env as Record<string, string | undefined>;
    if (saved[k] === undefined) delete env[k];
    else env[k] = saved[k];
  }
  vi.resetModules();
});

const read = async <K extends string>(key: K): Promise<unknown> => ((await import("@/lib/env")).env as unknown as Record<string, unknown>)[key];
const production = (extra: Record<string, string> = {}) => {
  Object.assign(process.env, { NODE_ENV: "production", BETTER_AUTH_SECRET: "Zq8vK2mXr9LpT4wYb7NcH1sJd6GfA3eU", BETTER_AUTH_URL: "https://shop.example", NEXT_PUBLIC_APP_URL: "https://shop.example", PAYMENT_WEBHOOK_SECRET: "Qw3rTy7uIo9pAs5dFg1hJk8lZx6cVb2N", TRUST_PROXY: "true", ALLOW_MOCK_PAYMENTS: "true", ...extra });
};

describe("environment validation", () => {
  it("fills safe development defaults", async () => {
    (process.env as Record<string, string>).NODE_ENV = "development";
    expect(await read("DATA_DIR")).toBe("data/runtime");
    expect(await read("PAYMENT_PROVIDER")).toBe("mock");
    expect(await read("TRUST_PROXY")).toBe(false);
    expect(await read("LOG_LEVEL")).toBe("info");
    expect(await read("MOCK_PAYMENT_LATENCY_MS")).toBe(350);
  });

  it("coerces and parses typed values", async () => {
    Object.assign(process.env, { NODE_ENV: "development", TRUST_PROXY: "true", MOCK_PAYMENT_LATENCY_MS: "0", LOG_LEVEL: "debug" });
    expect(await read("TRUST_PROXY")).toBe(true);
    expect(await read("MOCK_PAYMENT_LATENCY_MS")).toBe(0);
    expect(await read("LOG_LEVEL")).toBe("debug");
  });

  it("fails fast with a readable message for invalid values", async () => {
    Object.assign(process.env, { NODE_ENV: "development", PAYMENT_PROVIDER: "paypal", BETTER_AUTH_SECRET: "short" });
    await expect(read("PAYMENT_PROVIDER")).rejects.toThrowError(/Invalid environment configuration[\s\S]*BETTER_AUTH_SECRET[\s\S]*PAYMENT_PROVIDER/);
  });

  it("accepts a complete production configuration", async () => {
    production();
    expect(await read("NODE_ENV")).toBe("production");
    expect(await read("BETTER_AUTH_URL")).toBe("https://shop.example");
    expect(await read("PAYMENT_WEBHOOK_SECRET")).toBe("Qw3rTy7uIo9pAs5dFg1hJk8lZx6cVb2N");
  });

  it("refuses to run in production with development secrets or missing URLs", async () => {
    production({ BETTER_AUTH_SECRET: "dev-only-secret-dev-only-secret-0000" });
    await expect(read("NODE_ENV")).rejects.toThrow(/BETTER_AUTH_SECRET/);

    vi.resetModules();
    production();
    delete process.env.BETTER_AUTH_URL;
    await expect(read("NODE_ENV")).rejects.toThrow(/BETTER_AUTH_URL/);

    vi.resetModules();
    production();
    delete process.env.PAYMENT_WEBHOOK_SECRET;
    await expect(read("NODE_ENV")).rejects.toThrow(/PAYMENT_WEBHOOK_SECRET/);

    vi.resetModules();
    production({ PAYMENT_PROVIDER: "stripe" });
    await expect(read("NODE_ENV")).rejects.toThrow(/STRIPE_SECRET_KEY/);

    vi.resetModules();
    production({ PAYMENT_PROVIDER: "stripe", STRIPE_SECRET_KEY: "sk_live_x", STRIPE_WEBHOOK_SECRET: "whsec_x" });
    expect(await read("PAYMENT_PROVIDER")).toBe("stripe");
  });

  it("importing the module never reads the environment", async () => {
    Object.assign(process.env, { NODE_ENV: "production", BETTER_AUTH_SECRET: "bad" });
    await expect(import("@/lib/env")).resolves.toBeTruthy();
  });
});

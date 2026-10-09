import "server-only";
import { env } from "@/lib/env";
import type { PaymentProvider } from "@/lib/services/contracts";
import { MockPaymentProvider } from "./mock";
import { StripePaymentProvider } from "./stripe";

export type { PaymentProvider, PaymentWebhookEvent } from "@/lib/services/contracts";
export { createActionToken, signWebhookPayload, verifyActionToken } from "./signing";
export { detectBrand, digitsOnly, luhnValid, validateCard, type CardBrand, type CardInput } from "./card";

const KEY = Symbol.for("apexline.payments.provider");
type G = typeof globalThis & { [KEY]?: { id: string; provider: PaymentProvider } };

/** The configured provider (env `PAYMENT_PROVIDER`), created once per process. */
export function getPaymentProvider(): PaymentProvider {
  const g = globalThis as G;
  const wanted = env.PAYMENT_PROVIDER;
  if (!g[KEY] || g[KEY].id !== wanted) {
    g[KEY] = { id: wanted, provider: wanted === "stripe" ? new StripePaymentProvider() : new MockPaymentProvider() };
  }
  return g[KEY].provider;
}

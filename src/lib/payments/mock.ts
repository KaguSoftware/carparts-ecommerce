import "server-only";
import { env } from "@/lib/env";
import type { PaymentInput, PaymentProvider, PaymentWebhookEvent } from "@/lib/services/contracts";
import type { Payment } from "@/lib/types/domain";
import { detectBrand, digitsOnly, luhnValid, normalizeExpiryYear } from "./card";
import { createActionToken, shortHash, verifyActionToken, verifySignedPayload } from "./signing";

/**
 * Mock payment gateway. Deterministic, no network, never stores card data.
 *
 * Test cards (any future expiry, any 3-digit CVC; Amex needs 4):
 *   4242 4242 4242 4242 (and any other Luhn-valid number)  -> succeeded
 *   4000 0000 0000 0002                                    -> card_declined
 *   4000 0000 0000 9995                                    -> insufficient_funds
 *   4000 0000 0000 0069                                    -> expired_card
 *   4000 0000 0000 0119                                    -> processing_error
 *   4000 0025 0000 3155 / 4000 0000 0000 3220              -> requires_action (3-D-Secure style challenge)
 *
 * Test tokens (for `{ type: "token" }` payments): tok_visa, tok_mastercard, tok_chargeDeclined,
 * tok_insufficientFunds, tok_threeDSecure.
 */

type FailureCode = "card_declined" | "insufficient_funds" | "expired_card" | "processing_error";
type ChargeResult = Awaited<ReturnType<PaymentProvider["charge"]>>;

const SPECIAL_CARDS: Record<string, { kind: "fail"; code: FailureCode } | { kind: "action" }> = {
  "4000000000000002": { kind: "fail", code: "card_declined" },
  "4000000000009995": { kind: "fail", code: "insufficient_funds" },
  "4000000000000069": { kind: "fail", code: "expired_card" },
  "4000000000000119": { kind: "fail", code: "processing_error" },
  "4000002500003155": { kind: "action" },
  "4000000000003220": { kind: "action" },
};

const TOKENS: Record<string, { brand: string; last4: string; outcome: { kind: "ok" } | { kind: "fail"; code: FailureCode } | { kind: "action" } }> = {
  tok_visa: { brand: "visa", last4: "4242", outcome: { kind: "ok" } },
  tok_mastercard: { brand: "mastercard", last4: "4444", outcome: { kind: "ok" } },
  tok_chargeDeclined: { brand: "visa", last4: "0002", outcome: { kind: "fail", code: "card_declined" } },
  tok_insufficientFunds: { brand: "visa", last4: "9995", outcome: { kind: "fail", code: "insufficient_funds" } },
  tok_threeDSecure: { brand: "visa", last4: "3155", outcome: { kind: "action" } },
};

const REPLAY_KEY = Symbol.for("apexline.payments.mock.replay");
type G = typeof globalThis & { [REPLAY_KEY]?: Map<string, ChargeResult> };
const replay = (): Map<string, ChargeResult> => ((globalThis as G)[REPLAY_KEY] ??= new Map());
const REPLAY_MAX = 5000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function latency(): number {
  return env.NODE_ENV === "test" ? 0 : env.MOCK_PAYMENT_LATENCY_MS;
}

function methodFor(payment: PaymentInput): { method: NonNullable<Payment["method"]>; outcome: { kind: "ok" } | { kind: "fail"; code: FailureCode } | { kind: "action" } } {
  if (payment.type === "token") {
    const t = TOKENS[payment.token];
    if (!t) return { method: { brand: "card", last4: "0000", expMonth: 12, expYear: new Date().getUTCFullYear() + 2 }, outcome: { kind: "fail", code: "processing_error" } };
    return { method: { brand: t.brand, last4: t.last4, expMonth: 12, expYear: new Date().getUTCFullYear() + 2 }, outcome: t.outcome };
  }
  const number = digitsOnly(payment.card.number);
  const method = { brand: detectBrand(number), last4: number.slice(-4), expMonth: payment.card.expMonth, expYear: normalizeExpiryYear(payment.card.expYear) };
  if (!luhnValid(number)) return { method, outcome: { kind: "fail", code: "processing_error" } };
  const special = SPECIAL_CARDS[number];
  if (!special) return { method, outcome: { kind: "ok" } };
  return { method, outcome: special.kind === "fail" ? { kind: "fail", code: special.code } : { kind: "action" } };
}

export class MockPaymentProvider implements PaymentProvider {
  readonly id = "mock" as const;

  async charge(input: Parameters<PaymentProvider["charge"]>[0]): Promise<ChargeResult> {
    const cache = replay();
    const cached = cache.get(input.idempotencyKey);
    if (cached) return cached;

    const ms = latency();
    if (ms > 0) await sleep(ms);

    const providerRef = `mock_pi_${shortHash(input.idempotencyKey)}`;
    const { method, outcome } = methodFor(input.payment);
    let result: ChargeResult;
    if (input.amount <= 0 || !Number.isInteger(input.amount)) result = { status: "failed", code: "processing_error", providerRef };
    else if (outcome.kind === "fail") result = { status: "failed", code: outcome.code, providerRef };
    else if (outcome.kind === "action") result = { status: "requires_action", providerRef, actionToken: createActionToken(providerRef), method };
    else result = { status: "succeeded", providerRef, method };

    if (cache.size >= REPLAY_MAX) cache.clear();
    cache.set(input.idempotencyKey, result);
    return result;
  }

  async confirmAction(input: Parameters<PaymentProvider["confirmAction"]>[0]): Promise<Awaited<ReturnType<PaymentProvider["confirmAction"]>>> {
    const ms = latency();
    if (ms > 0) await sleep(Math.min(ms, 500));
    if (!input.providerRef.startsWith("mock_pi_") || !verifyActionToken(input.providerRef, input.actionToken)) return { status: "failed", code: "authentication_failed" };
    if (!input.approved) return { status: "failed", code: "authentication_failed" };
    return { status: "succeeded", providerRef: input.providerRef };
  }

  async refund(input: Parameters<PaymentProvider["refund"]>[0]): Promise<Awaited<ReturnType<PaymentProvider["refund"]>>> {
    const ms = latency();
    if (ms > 0) await sleep(Math.min(ms, 500));
    if (!input.providerRef.startsWith("mock_pi_") && !input.providerRef.startsWith("mock_")) return { status: "failed", code: "unknown_payment" };
    if (!Number.isInteger(input.amount) || input.amount <= 0) return { status: "failed", code: "invalid_amount" };
    return { status: "succeeded", refundRef: `mock_re_${shortHash(`${input.providerRef}:${input.idempotencyKey}`)}` };
  }

  verifyWebhook(rawBody: string, signature: string | null): { valid: true; event: PaymentWebhookEvent } | { valid: false } {
    if (!verifySignedPayload(rawBody, signature, env.PAYMENT_WEBHOOK_SECRET)) return { valid: false };
    try {
      const body = JSON.parse(rawBody) as { type?: unknown; providerRef?: unknown; code?: unknown; refundRef?: unknown };
      if (typeof body.providerRef !== "string" || !body.providerRef) return { valid: false };
      switch (body.type) {
        case "payment.succeeded":
          return { valid: true, event: { type: "payment.succeeded", providerRef: body.providerRef } };
        case "payment.failed":
          return { valid: true, event: { type: "payment.failed", providerRef: body.providerRef, ...(typeof body.code === "string" ? { code: body.code } : {}) } };
        case "refund.succeeded":
          return { valid: true, event: { type: "refund.succeeded", providerRef: body.providerRef, ...(typeof body.refundRef === "string" ? { refundRef: body.refundRef } : {}) } };
        default:
          return { valid: false };
      }
    } catch {
      return { valid: false };
    }
  }
}


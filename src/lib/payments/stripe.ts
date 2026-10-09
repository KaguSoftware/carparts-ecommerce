import "server-only";
import { env } from "@/lib/env";
import { DomainError } from "@/lib/errors";
import type { PaymentProvider, PaymentWebhookEvent } from "@/lib/services/contracts";
import { verifySignedPayload } from "./signing";

/**
 * STRIPE ADAPTER SLOT (not enabled by default; `PAYMENT_PROVIDER=stripe` selects it).
 *
 * Money methods intentionally throw until the Stripe SDK is wired; webhook signature verification is real
 * (it only needs HMAC), so the endpoint can be exercised with `stripe listen`.
 *
 * Wiring guide
 * ------------
 * 1. `npm i stripe`, set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET (validated in src/lib/env.ts).
 * 2. charge(): the browser tokenises the card with Stripe Elements and sends `{ type: "token", token: pm_xxx }`
 *    (PaymentInput already has this variant; checkout never sees a raw card number). Create
 *    `stripe.paymentIntents.create({ amount, currency: currency.toLowerCase(), payment_method: token,
 *    confirm: true, metadata, automatic_payment_methods: { enabled: true, allow_redirects: "never" } },
 *    { idempotencyKey })`.
 *      - status "succeeded"       -> { status: "succeeded", providerRef: pi.id, method: from pi.latest_charge }
 *      - status "requires_action" -> { status: "requires_action", providerRef: pi.id, actionToken: pi.client_secret, method }
 *        (the UI calls stripe.handleNextAction({ clientSecret }) and then completePaymentAction({ approved: true }))
 *      - card errors              -> map error.code: card_declined | insufficient_funds | expired_card, else processing_error
 * 3. confirmAction(): retrieve the PaymentIntent by providerRef and report whether it is `succeeded`
 *    (do not trust `approved` from the client).
 * 4. refund(): `stripe.refunds.create({ payment_intent: providerRef, amount, reason: "requested_by_customer" }, { idempotencyKey })`.
 * 5. Webhook (`/api/webhooks/payments`): `payment_intent.succeeded`, `payment_intent.payment_failed` and
 *    `charge.refunded` are normalised below; checkout reconciles late 3-D-Secure completions from them.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly id = "stripe" as const;

  private notWired(): never {
    throw new DomainError("payment_failed", { status: 501, message: "Stripe adapter is not wired yet (see src/lib/payments/stripe.ts)" });
  }

  async charge(): Promise<never> {
    return this.notWired();
  }

  async confirmAction(): Promise<never> {
    return this.notWired();
  }

  async refund(): Promise<never> {
    return this.notWired();
  }

  verifyWebhook(rawBody: string, signature: string | null): { valid: true; event: PaymentWebhookEvent } | { valid: false } {
    const secret = env.STRIPE_WEBHOOK_SECRET;
    if (!secret || !verifySignedPayload(rawBody, signature, secret)) return { valid: false };
    try {
      const body = JSON.parse(rawBody) as { type?: string; data?: { object?: { id?: string; payment_intent?: string; last_payment_error?: { code?: string } } } };
      const object = body.data?.object;
      switch (body.type) {
        case "payment_intent.succeeded":
          return object?.id ? { valid: true, event: { type: "payment.succeeded", providerRef: object.id } } : { valid: false };
        case "payment_intent.payment_failed":
          return object?.id ? { valid: true, event: { type: "payment.failed", providerRef: object.id, code: object.last_payment_error?.code } } : { valid: false };
        case "charge.refunded":
          return object?.payment_intent ? { valid: true, event: { type: "refund.succeeded", providerRef: object.payment_intent } } : { valid: false };
        default:
          return { valid: false };
      }
    } catch {
      return { valid: false };
    }
  }
}

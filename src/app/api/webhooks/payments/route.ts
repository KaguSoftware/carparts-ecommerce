import { json, problem } from "@/lib/api/respond";
import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getPaymentProvider } from "@/lib/payments";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { applyPaymentEvent } from "@/lib/services/checkout";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/payments - provider event receiver (server to server; no cookies, no CSRF check).
 * The signature is verified against the RAW body (`x-apexline-signature` for the mock provider, `stripe-signature`
 * for Stripe). Events are idempotent: replays are acknowledged and ignored.
 */
export async function POST(request: Request) {
  try {
    await enforceRateLimit("payment-webhook", { limit: 300, windowMs: 60_000 });
    const raw = await request.text();
    if (raw.length > 256 * 1024) throw new DomainError("file_too_large", { status: 413 });
    const signature = request.headers.get("x-apexline-signature") ?? request.headers.get("stripe-signature");
    const verified = getPaymentProvider().verifyWebhook(raw, signature);
    if (!verified.valid) {
      logger.warn("payment.webhook_rejected");
      throw new DomainError("invalid_token", { status: 400 });
    }
    const result = await applyPaymentEvent(verified.event);
    return json({ received: true, result });
  } catch (error) {
    return problem(error);
  }
}

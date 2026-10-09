"use server";

import { runAction, type ActionResult } from "@/lib/action-result";
import { resolveCart } from "@/lib/api/cart-context";
import { getSessionUser } from "@/lib/auth/session";
import { revalidateAccount, revalidateStore } from "@/lib/cache";
import { DomainError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { completePaymentAction as completePayment, getCheckoutQuote, placeOrder } from "@/lib/services/checkout";
import type { CheckoutQuote, OrderAccess, PlaceOrderResult } from "@/lib/services/contracts";
import { checkoutQuoteSchema, confirmPaymentSchema, placeOrderSchema, type PaymentOutcome } from "./checkout.schema";

/**
 * Checkout Server Actions. Prices, shipping, tax and totals are ALWAYS recomputed by the checkout service from the
 * server-side cart; nothing money-related from the browser is trusted (ARCHITECTURE.md rule 5).
 */

/** Authoritative totals + shipping options for a destination. Called on every address / method / coupon change. */
export async function getCheckoutQuoteAction(raw: unknown): Promise<ActionResult<CheckoutQuote>> {
  return runAction(checkoutQuoteSchema, raw, async (input) => {
    await enforceRateLimit("checkout-quote", { limit: 240, windowMs: 60_000 });
    const { cart, userId } = await resolveCart({ create: false });
    if (!cart) throw new DomainError("cart_empty", { status: 409 });
    return getCheckoutQuote({
      cartId: cart.id,
      destination: { country: input.country, region: input.region, ...(input.postalCode ? { postalCode: input.postalCode } : {}) },
      ...(input.shippingMethodId ? { shippingMethodId: input.shippingMethodId } : {}),
      locale: input.locale,
      userId,
    });
  });
}

function toOutcome(result: PlaceOrderResult): PaymentOutcome {
  switch (result.status) {
    case "succeeded":
      return { status: "succeeded", orderNumber: result.order.number, accessToken: result.order.accessToken };
    case "requires_action":
      return { status: "requires_action", orderNumber: result.order.number, accessToken: result.order.accessToken, actionToken: result.actionToken };
    case "failed":
      // A decline keeps the order pending so the same idempotency key can retry on it; surface the reason code.
      throw new DomainError(result.error, { status: 402 });
  }
}

/** Places the order and charges the card. Idempotent on `idempotencyKey`. */
export async function placeOrderAction(raw: unknown): Promise<ActionResult<PaymentOutcome>> {
  return runAction(placeOrderSchema, raw, async (input) => {
    await enforceRateLimit("checkout", { limit: 20, windowMs: 10 * 60_000 });
    const user = await getSessionUser();
    const email = user?.email ?? input.email;
    if (!email) throw new DomainError("validation_failed", { fieldErrors: { email: ["required"] } });

    const { cart, userId } = await resolveCart({ create: false });
    if (!cart) throw new DomainError("cart_empty", { status: 409 });

    const result = await placeOrder({
      cartId: cart.id,
      userId,
      email,
      shippingAddress: input.shippingAddress,
      ...(input.billingAddress ? { billingAddress: input.billingAddress } : {}),
      shippingMethodId: input.shippingMethodId,
      locale: input.locale,
      ...(input.customerNote ? { customerNote: input.customerNote } : {}),
      idempotencyKey: input.idempotencyKey,
      payment: { type: "card", card: input.payment.card },
      newsletterOptIn: input.newsletterOptIn,
      saveAddress: Boolean(userId) && input.saveAddress,
      ...(input.expectedTotal !== undefined ? { expectedTotal: input.expectedTotal } : {}),
    });

    if (result.status === "succeeded") {
      revalidateStore();
      if (userId) revalidateAccount();
    }
    return toOutcome(result);
  });
}

/** Second leg of a 3-D-Secure style challenge: the customer approved or rejected it at their "bank". */
export async function confirmPaymentAction(raw: unknown): Promise<ActionResult<PaymentOutcome>> {
  return runAction(confirmPaymentSchema, raw, async (input) => {
    await enforceRateLimit("checkout-confirm", { limit: 20, windowMs: 10 * 60_000 });
    const user = await getSessionUser();
    const access: OrderAccess | null = input.accessToken ? { accessToken: input.accessToken } : user ? { userId: user.id } : null;
    if (!access) throw new DomainError("unauthorized", { status: 401 });

    const result = await completePayment({ orderNumber: input.orderNumber, actionToken: input.actionToken, approved: input.approved, access });
    if (result.status === "succeeded") {
      revalidateStore();
      if (user) revalidateAccount();
    }
    return toOutcome(result);
  });
}

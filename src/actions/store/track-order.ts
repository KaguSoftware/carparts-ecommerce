"use server";

import { z } from "zod";
import { fail, runAction, type ActionResult } from "@/lib/action-result";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { trackOrder } from "@/lib/services/orders";
import { emailSchema } from "@/lib/validation/common";
import type { TrackedOrder } from "./track-order.types";

const schema = z.object({
  number: z.string().trim().min(3, "required").max(30, "too_long"),
  email: emailSchema,
});

/** Guest order lookup: both the order number and the email must match, otherwise a generic not-found. */
export async function trackOrderAction(raw: unknown): Promise<ActionResult<TrackedOrder>> {
  const result = await runAction(schema, raw, async ({ number, email }) => {
    await enforceRateLimit("track-order", { limit: 10, windowMs: 10 * 60_000 });
    return trackOrder({ number, email });
  });
  if (!result.ok) return result;
  const order = result.data;
  if (!order) return fail("order_not_found");
  const dto: TrackedOrder = {
    number: order.number,
    status: order.status,
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt,
    currency: order.currency,
    fxRate: order.fxRate,
    items: order.items.map((i) => ({
      name: i.name,
      variantName: i.variantName,
      brandName: i.brandName,
      ...(i.image ? { image: i.image } : {}),
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
    })),
    subtotal: order.subtotal,
    discount: order.discount,
    shipping: order.shipping,
    tax: order.tax,
    total: order.total,
    shippingMethod: order.shippingMethod.name,
    estimatedDays: { min: order.shippingMethod.estimatedDaysMin, max: order.shippingMethod.estimatedDaysMax },
    ...(order.trackingNumber ? { trackingNumber: order.trackingNumber } : {}),
    ...(order.carrier ? { carrier: order.carrier } : {}),
    ...(order.shippedAt ? { shippedAt: order.shippedAt } : {}),
    ...(order.deliveredAt ? { deliveredAt: order.deliveredAt } : {}),
    destination: { city: order.shippingAddress.city, region: order.shippingAddress.region, country: order.shippingAddress.country },
    timeline: order.events
      .filter((e) => e.type !== "note" && e.type !== "email_sent")
      .map((e) => ({ at: e.at, type: e.type, ...(e.status ? { status: e.status } : {}) })),
  };
  return { ok: true, data: dto };
}

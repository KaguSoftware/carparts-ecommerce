"use server";

import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/action-result";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { submitMessage } from "@/lib/services/contact";
import { emailSchema, localeSchema, phoneSchema } from "@/lib/validation/common";

const schema = z.object({
  name: z.string().trim().min(1, "required").max(80, "too_long"),
  email: emailSchema,
  phone: z.union([phoneSchema, z.literal("")]).optional(),
  subject: z.string().trim().min(2, "required").max(150, "too_long"),
  message: z.string().trim().min(10, "too_short").max(5000, "too_long"),
  orderNumber: z.string().trim().max(30, "too_long").optional(),
  locale: localeSchema,
});

export async function submitContactAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(schema, raw, async (input) => {
    await enforceRateLimit("contact", { limit: 5, windowMs: 15 * 60_000 });
    const message = await submitMessage({
      name: input.name,
      email: input.email,
      subject: input.subject,
      message: input.message,
      locale: input.locale,
      ...(input.phone ? { phone: input.phone } : {}),
      ...(input.orderNumber ? { orderNumber: input.orderNumber } : {}),
    });
    return { id: message.id };
  });
}

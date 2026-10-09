"use server";

import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/action-result";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { subscribe } from "@/lib/services/newsletter";
import { emailSchema, localeSchema } from "@/lib/validation/common";

const schema = z.object({
  email: emailSchema,
  source: z.string().trim().min(1).max(40).default("footer"),
  locale: localeSchema.default("en"),
});

export async function subscribeNewsletterAction(raw: unknown): Promise<ActionResult<{ alreadySubscribed: boolean }>> {
  return runAction(schema, raw, async ({ email, source, locale }) => {
    await enforceRateLimit("newsletter", { limit: 5, windowMs: 10 * 60_000 });
    return subscribe({ email, locale, source });
  });
}

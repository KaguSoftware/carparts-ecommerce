"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/action-result";
import { getSessionUser } from "@/lib/auth/session";
import { currentClientIp } from "@/lib/security/ip";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createReview, markHelpful } from "@/lib/services/reviews";
import { idSchema, localeSchema } from "@/lib/validation/common";

const reviewSchema = z.object({
  productId: idSchema,
  rating: z.number({ error: "rating_required" }).int("rating_required").min(1, "rating_required").max(5, "rating_required"),
  title: z.string().trim().min(2, "required").max(120, "too_long"),
  body: z.string().trim().min(10, "too_short").max(4000, "too_long"),
  authorName: z.string().trim().max(60, "too_long").optional(),
  locale: localeSchema,
});

/** Creates a pending review (moderated before it shows). Guests must give a display name. */
export async function submitReviewAction(raw: unknown): Promise<ActionResult<{ pending: true }>> {
  return runAction(reviewSchema, raw, async (input) => {
    await enforceRateLimit("review", { limit: 5, windowMs: 10 * 60_000 });
    const user = await getSessionUser();
    const authorName = (input.authorName || user?.name || "").trim();
    await createReview({
      productId: input.productId,
      userId: user?.id ?? null,
      authorName,
      rating: input.rating as 1 | 2 | 3 | 4 | 5,
      title: input.title,
      body: input.body,
      locale: input.locale,
    });
    return { pending: true as const };
  });
}

const helpfulSchema = z.object({ reviewId: idSchema });

export async function markReviewHelpfulAction(raw: unknown): Promise<ActionResult<{ helpfulCount: number }>> {
  return runAction(helpfulSchema, raw, async ({ reviewId }) => {
    const ip = await currentClientIp();
    await enforceRateLimit("review-helpful", { limit: 30, windowMs: 60_000, ip });
    const user = await getSessionUser();
    const ua = (await headers()).get("user-agent") ?? "";
    const voterKey = user ? `u:${user.id}` : `g:${createHash("sha256").update(`${ip}|${ua}`).digest("hex").slice(0, 24)}`;
    return markHelpful(reviewId, voterKey);
  });
}

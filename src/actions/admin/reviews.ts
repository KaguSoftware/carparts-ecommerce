"use server";

import { z } from "zod";
import { deleteReview, replyToReview, setReviewStatus } from "@/lib/services/reviews";
import { idSchema } from "@/lib/validation/common";
import { adminAction, refresh } from "./_shared";

const statusSchema = z.object({ id: idSchema, status: z.enum(["pending", "approved", "rejected"]) });
const replySchema = z.object({ id: idSchema, body: z.string().trim().min(1, "required").max(1000, "too_long") });
const idOnly = z.object({ id: idSchema });

const PATHS = ["/admin/reviews", "/admin"];

export async function setReviewStatusAction(raw: unknown) {
  return adminAction("reviews.moderate", statusSchema, raw, async ({ id, status }, { actor }) => {
    await setReviewStatus(id, status, actor);
    refresh(PATHS, { store: true });
  });
}

export async function replyToReviewAction(raw: unknown) {
  return adminAction("reviews.moderate", replySchema, raw, async ({ id, body }, { actor }) => {
    await replyToReview(id, body, actor);
    refresh(PATHS, { store: true });
  });
}

export async function deleteReviewAction(raw: unknown) {
  return adminAction("reviews.moderate", idOnly, raw, async ({ id }, { actor }) => {
    await deleteReview(id, actor);
    refresh(PATHS, { store: true });
  });
}

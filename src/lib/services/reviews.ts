import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { zodFieldErrors } from "@/lib/action-result";
import { db } from "@/lib/db";
import { DomainError, notFound } from "@/lib/errors";
import type { Actor, Id, LocalizedString, Paged, PageParams, Review, ReviewStatus } from "@/lib/types/domain";
import type { ReviewInput } from "./contracts";
import { logAudit } from "./audit";
import { actorLabel, includesText, nowIso, paginate, round1 } from "./_shared";
import { hasUserPurchased } from "./orders";

const reviewSchema = z.object({
  productId: z.string().min(1, "required"),
  userId: z.string().nullable().optional(),
  authorName: z.string().trim().min(1, "required").max(60, "too_long"),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)], { error: "rating_required" }),
  title: z.string().trim().min(2, "required").max(120, "too_long"),
  body: z.string().trim().min(10, "too_short").max(4000, "too_long"),
  locale: z.enum(["en", "tr"]),
});

export async function listApprovedReviews(
  productId: Id,
  params: PageParams & { sort?: "newest" | "highest" | "lowest" | "helpful"; rating?: number } = {},
): Promise<Paged<Review>> {
  const rows = await db.reviews.find({ where: (r) => r.productId === productId && r.status === "approved" && (params.rating === undefined || r.rating === params.rating) });
  switch (params.sort ?? "newest") {
    case "highest":
      rows.sort((a, b) => b.rating - a.rating || b.createdAt.localeCompare(a.createdAt));
      break;
    case "lowest":
      rows.sort((a, b) => a.rating - b.rating || b.createdAt.localeCompare(a.createdAt));
      break;
    case "helpful":
      rows.sort((a, b) => b.helpfulCount - a.helpfulCount || b.createdAt.localeCompare(a.createdAt));
      break;
    default:
      rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return paginate(rows, params, 10);
}

export async function canReview(userId: Id, productId: Id): Promise<{ allowed: boolean; reason?: "already_reviewed"; verifiedPurchase: boolean }> {
  const [existing, verifiedPurchase] = await Promise.all([db.reviews.findOne((r) => r.userId === userId && r.productId === productId), hasUserPurchased(userId, productId)]);
  if (existing) return { allowed: false, reason: "already_reviewed", verifiedPurchase };
  return { allowed: true, verifiedPurchase };
}

export async function createReview(input: ReviewInput): Promise<Review> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("validation_failed", { fieldErrors: zodFieldErrors(parsed.error) });
  const data = parsed.data;
  return db.transaction(async () => {
    const product = await db.products.get(data.productId);
    if (!product || product.status !== "active") throw new DomainError("product_unavailable", { status: 404 });
    if (data.userId) {
      if (await db.reviews.findOne((r) => r.userId === data.userId && r.productId === data.productId)) throw new DomainError("conflict", { status: 409 });
    }
    const verifiedPurchase = data.userId ? await hasUserPurchased(data.userId, data.productId) : false;
    const at = nowIso();
    return db.reviews.insert({
      productId: data.productId,
      userId: data.userId ?? null,
      authorName: data.authorName,
      rating: data.rating,
      title: data.title,
      body: data.body,
      locale: data.locale,
      status: "pending",
      verifiedPurchase,
      helpfulCount: 0,
      createdAt: at,
      updatedAt: at,
    });
  });
}

/** `voterKey` is an opaque caller identity (user id, or a hash of ip+user agent); it is hashed before storage. */
export async function markHelpful(reviewId: Id, voterKey: string): Promise<{ helpfulCount: number }> {
  const key = createHash("sha256").update(`${reviewId}:${voterKey}`).digest("hex").slice(0, 32);
  return db.transaction(async () => {
    const review = await db.reviews.get(reviewId);
    if (!review || review.status !== "approved") throw notFound("review");
    if (await db.reviewVotes.findOne((v) => v.reviewId === reviewId && v.voterKey === key)) return { helpfulCount: review.helpfulCount };
    await db.reviewVotes.insert({ reviewId, voterKey: key, at: nowIso() });
    const updated = await db.reviews.update(reviewId, { helpfulCount: review.helpfulCount + 1 });
    return { helpfulCount: updated.helpfulCount };
  });
}

/** Every review written by a customer (any status) with the product it belongs to, newest first. Account area. */
export async function listReviewsForUser(userId: Id): Promise<(Review & { productName: LocalizedString; productSlug: string; productImage?: string })[]> {
  const rows = await db.reviews.find({ where: (r) => r.userId === userId, orderBy: [{ field: "createdAt", direction: "desc" }] });
  const products = new Map((await db.products.getMany([...new Set(rows.map((r) => r.productId))])).map((p) => [p.id, p]));
  return rows.map((r) => {
    const product = products.get(r.productId);
    return { ...r, productName: product?.name ?? { en: "(deleted)", tr: "(silindi)" }, productSlug: product?.slug ?? "", ...(product?.images[0] ? { productImage: product.images[0].url } : {}) };
  });
}

/** Recompute the denormalised rating on a product from its approved reviews. */
export async function recomputeProductRating(productId: Id): Promise<void> {
  const approved = await db.reviews.find({ where: (r) => r.productId === productId && r.status === "approved" });
  const count = approved.length;
  const average = count ? round1(approved.reduce((s, r) => s + r.rating, 0) / count) : 0;
  if (await db.products.get(productId)) await db.products.update(productId, { ratingAverage: average, ratingCount: count });
}

export async function adminListReviews(
  filter: PageParams & { status?: ReviewStatus | "all"; productId?: Id; q?: string; rating?: number },
): Promise<Paged<Review & { productName: LocalizedString; productSlug: string }>> {
  const rows = await db.reviews.find({
    where: (r) =>
      (!filter.status || filter.status === "all" || r.status === filter.status) &&
      (!filter.productId || r.productId === filter.productId) &&
      (filter.rating === undefined || r.rating === filter.rating) &&
      (!filter.q || includesText([r.title, r.body, r.authorName], filter.q)),
    orderBy: [{ field: "createdAt", direction: "desc" }],
  });
  const page = paginate(rows, filter, 25);
  const products = new Map((await db.products.getMany([...new Set(page.items.map((r) => r.productId))])).map((p) => [p.id, p]));
  return {
    ...page,
    items: page.items.map((r) => ({ ...r, productName: products.get(r.productId)?.name ?? { en: "(deleted)", tr: "(silindi)" }, productSlug: products.get(r.productId)?.slug ?? "" })),
  };
}

export async function setReviewStatus(id: Id, status: ReviewStatus, actor: Actor): Promise<Review> {
  if (!["pending", "approved", "rejected"].includes(status)) throw new DomainError("validation_failed");
  return db.transaction(async () => {
    const current = await db.reviews.get(id);
    if (!current) throw notFound("review");
    const saved = await db.reviews.update(id, { status, updatedAt: nowIso() });
    await recomputeProductRating(current.productId);
    await logAudit({ actor, action: "review.status_change", entityType: "review", entityId: id, summary: `Review by ${current.authorName}: ${current.status} -> ${status}`, changes: { status: { from: current.status, to: status } } });
    return saved;
  });
}

export async function replyToReview(id: Id, body: string, actor: Actor): Promise<Review> {
  const text = body.trim();
  if (text.length < 2 || text.length > 2000) throw new DomainError("validation_failed", { fieldErrors: { body: [text.length < 2 ? "required" : "too_long"] } });
  return db.transaction(async () => {
    const current = await db.reviews.get(id);
    if (!current) throw notFound("review");
    const saved = await db.reviews.update(id, { adminReply: { body: text, at: nowIso(), by: actorLabel(actor) }, updatedAt: nowIso() });
    await logAudit({ actor, action: "review.reply", entityType: "review", entityId: id, summary: `Replied to review by ${current.authorName}` });
    return saved;
  });
}

export async function deleteReview(id: Id, actor: Actor): Promise<void> {
  await db.transaction(async () => {
    const current = await db.reviews.get(id);
    if (!current) throw notFound("review");
    await db.reviews.delete(id);
    await db.reviewVotes.deleteWhere((v) => v.reviewId === id);
    await recomputeProductRating(current.productId);
    await logAudit({ actor, action: "review.delete", entityType: "review", entityId: id, summary: `Deleted review by ${current.authorName}` });
  });
}

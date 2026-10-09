import { freshSeed, STAFF } from "../helpers/test-env";
import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import { db } from "@/lib/db";
import { outboxDir } from "@/lib/email";
import * as contact from "@/lib/services/contact";
import * as newsletter from "@/lib/services/newsletter";
import * as reviews from "@/lib/services/reviews";
import * as wishlist from "@/lib/services/wishlist";

beforeAll(async () => {
  await freshSeed();
}, 60_000);

const mail = () => (fs.existsSync(outboxDir()) ? fs.readdirSync(outboxDir()).map((n) => JSON.parse(fs.readFileSync(`${outboxDir()}/${n}`, "utf8")) as { template: string; to: string }) : []);

describe("reviews", () => {
  const review = (productId: string, over: Partial<Parameters<typeof reviews.createReview>[0]> = {}) => ({
    productId,
    authorName: "Pat Doe",
    rating: 5 as const,
    title: "Great pads",
    body: "Stopped my car quietly and fit perfectly.",
    locale: "en" as const,
    ...over,
  });

  it("creates pending reviews, marks verified purchases, and allows one review per user per product", async () => {
    const orders = await db.orders.find({ where: (o) => o.userId === "usr_customer" && o.status === "delivered" });
    const existing = new Set((await db.reviews.find({ where: (r) => r.userId === "usr_customer" })).map((r) => r.productId));
    const purchased = orders.flatMap((o) => o.items.map((i) => i.productId)).find((id) => !existing.has(id))!;
    expect(purchased).toBeTruthy();
    const other = (await db.products.find({ where: (p) => p.status === "active" && p.id !== purchased }))[0]!;

    expect(await reviews.canReview("usr_customer", purchased)).toMatchObject({ allowed: true, verifiedPurchase: true });
    const mine = await reviews.createReview(review(purchased, { userId: "usr_customer" }));
    expect(mine).toMatchObject({ status: "pending", verifiedPurchase: true, helpfulCount: 0 });
    expect(await reviews.canReview("usr_customer", purchased)).toMatchObject({ allowed: false, reason: "already_reviewed" });
    await expect(reviews.createReview(review(purchased, { userId: "usr_customer" }))).rejects.toMatchObject({ code: "conflict" });

    const unverified = await reviews.createReview(review(other.id, { userId: "usr_c10" }));
    expect(unverified.verifiedPurchase).toBe(false);
    const guest = await reviews.createReview(review(other.id));
    expect(guest.userId).toBeNull();

    // pending reviews are invisible
    const visible = await reviews.listApprovedReviews(purchased, { pageSize: 100 });
    expect(visible.items.find((r) => r.id === mine.id)).toBeUndefined();
  });

  it("validates input", async () => {
    const p = (await db.products.findOne((x) => x.status === "active"))!;
    await expect(reviews.createReview(review(p.id, { rating: 6 as never }))).rejects.toMatchObject({ code: "validation_failed" });
    await expect(reviews.createReview(review(p.id, { body: "short" }))).rejects.toMatchObject({ fieldErrors: { body: ["too_short"] } });
    await expect(reviews.createReview(review(p.id, { title: "" }))).rejects.toMatchObject({ code: "validation_failed" });
    await expect(reviews.createReview(review("prd_missing"))).rejects.toMatchObject({ code: "product_unavailable" });
    const draft = (await db.products.findOne((x) => x.status === "draft"))!;
    await expect(reviews.createReview(review(draft.id))).rejects.toMatchObject({ code: "product_unavailable" });
  });

  it("moderation recomputes the product's rating aggregates", async () => {
    const p = (await db.products.find({ where: (x) => x.status === "active" }))[9]!;
    await db.reviews.deleteWhere((r) => r.productId === p.id);
    await reviews.recomputeProductRating(p.id);
    const r5 = await reviews.createReview(review(p.id, { rating: 5 }));
    const r2 = await reviews.createReview(review(p.id, { rating: 2 }));
    const r4 = await reviews.createReview(review(p.id, { rating: 4 }));
    expect((await db.products.get(p.id))!.ratingCount).toBe(0);

    await reviews.setReviewStatus(r5.id, "approved", STAFF);
    await reviews.setReviewStatus(r2.id, "approved", STAFF);
    expect(await db.products.get(p.id)).toMatchObject({ ratingAverage: 3.5, ratingCount: 2 });
    await reviews.setReviewStatus(r4.id, "approved", STAFF);
    expect(await db.products.get(p.id)).toMatchObject({ ratingAverage: 3.7, ratingCount: 3 });
    await reviews.setReviewStatus(r2.id, "rejected", STAFF);
    expect(await db.products.get(p.id)).toMatchObject({ ratingAverage: 4.5, ratingCount: 2 });
    await reviews.deleteReview(r5.id, STAFF);
    expect(await db.products.get(p.id)).toMatchObject({ ratingAverage: 4, ratingCount: 1 });
    await reviews.deleteReview(r4.id, STAFF);
    expect(await db.products.get(p.id)).toMatchObject({ ratingAverage: 0, ratingCount: 0 });

    const audit = await db.auditLog.find({ where: (a) => a.action === "review.status_change" && a.entityId === r5.id });
    expect(audit).toHaveLength(1);
    await expect(reviews.setReviewStatus("rev_missing", "approved", STAFF)).rejects.toMatchObject({ code: "not_found" });
  });

  it("lists approved reviews with sorting and rating filter; admin list filters and joins product names", async () => {
    const p = (await db.reviews.find({ where: (r) => r.status === "approved" }))[0]!;
    const list = await reviews.listApprovedReviews(p.productId, { pageSize: 100, sort: "highest" });
    const ratings = list.items.map((r) => r.rating);
    expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
    const lowest = await reviews.listApprovedReviews(p.productId, { pageSize: 100, sort: "lowest" });
    expect(lowest.items.map((r) => r.rating)).toEqual([...ratings].sort((a, b) => a - b));
    const fiveStar = await reviews.listApprovedReviews(p.productId, { rating: 5, pageSize: 100 });
    expect(fiveStar.items.every((r) => r.rating === 5)).toBe(true);
    const pending = await reviews.adminListReviews({ status: "pending", pageSize: 100 });
    expect(pending.items.every((r) => r.status === "pending" && r.productSlug)).toBe(true);
    expect(pending.items[0]!.productName.en.length).toBeGreaterThan(0);
    expect((await reviews.adminListReviews({ q: "no-such-text-xyz" })).total).toBe(0);
  });

  it("helpful votes count once per voter; admins can reply", async () => {
    const approved = (await db.reviews.find({ where: (r) => r.status === "approved" }))[0]!;
    const first = await reviews.markHelpful(approved.id, "voter-1");
    expect(first.helpfulCount).toBe(approved.helpfulCount + 1);
    expect((await reviews.markHelpful(approved.id, "voter-1")).helpfulCount).toBe(first.helpfulCount);
    expect((await reviews.markHelpful(approved.id, "voter-2")).helpfulCount).toBe(first.helpfulCount + 1);
    const pending = (await db.reviews.find({ where: (r) => r.status === "pending" }))[0]!;
    await expect(reviews.markHelpful(pending.id, "voter-1")).rejects.toMatchObject({ code: "not_found" });

    const replied = await reviews.replyToReview(approved.id, "Thanks for the feedback!", STAFF);
    expect(replied.adminReply).toMatchObject({ body: "Thanks for the feedback!", by: STAFF.email });
    await expect(reviews.replyToReview(approved.id, " ", STAFF)).rejects.toMatchObject({ code: "validation_failed" });
  });
});

describe("wishlist", () => {
  it("toggles products, keeps newest first, and exposes summaries", async () => {
    const [a, b] = await db.products.find({ where: (p) => p.status === "active", limit: 2 });
    await wishlist.clearWishlist("usr_c04");
    expect(await wishlist.toggleWishlist("usr_c04", a!.id)).toEqual({ inWishlist: true, count: 1 });
    expect(await wishlist.toggleWishlist("usr_c04", b!.id)).toEqual({ inWishlist: true, count: 2 });
    expect(await wishlist.getWishlistIds("usr_c04")).toEqual([b!.id, a!.id]);
    expect((await wishlist.getWishlistProducts("usr_c04")).map((p) => p.id)).toEqual([b!.id, a!.id]);
    expect(await wishlist.toggleWishlist("usr_c04", a!.id)).toEqual({ inWishlist: false, count: 1 });
    await wishlist.removeFromWishlist("usr_c04", b!.id);
    expect(await wishlist.getWishlistIds("usr_c04")).toEqual([]);
    await wishlist.removeFromWishlist("usr_c04", "prd_not_there"); // no-op
    await expect(wishlist.toggleWishlist("usr_c04", "prd_missing")).rejects.toMatchObject({ code: "product_unavailable" });
    const draft = (await db.products.findOne((p) => p.status === "draft"))!;
    await expect(wishlist.toggleWishlist("usr_c04", draft.id)).rejects.toMatchObject({ code: "product_unavailable" });
  });

  it("is per user and hides products that went inactive", async () => {
    const p = (await db.products.find({ where: (x) => x.status === "active" }))[3]!;
    await wishlist.toggleWishlist("usr_c04", p.id);
    expect(await wishlist.getWishlistIds("usr_c05")).not.toContain(p.id);
    await db.products.update(p.id, { status: "archived" });
    expect((await wishlist.getWishlistProducts("usr_c04")).map((x) => x.id)).not.toContain(p.id);
    await db.products.update(p.id, { status: "active" });
    await wishlist.clearWishlist("usr_c04");
    expect(await wishlist.getWishlistIds("usr_c04")).toEqual([]);
  });
});

describe("newsletter", () => {
  it("subscribes once, re-subscribes after unsubscribing, and exports only active subscribers", async () => {
    expect(await newsletter.subscribe({ email: " New.Reader@Example.com ", locale: "tr", source: "footer" })).toEqual({ alreadySubscribed: false });
    expect(await newsletter.subscribe({ email: "new.reader@example.com", locale: "en", source: "checkout" })).toEqual({ alreadySubscribed: true });
    expect((await db.newsletter.findOne((n) => n.email === "new.reader@example.com"))).toMatchObject({ locale: "tr", source: "footer" });
    await newsletter.unsubscribe("NEW.READER@example.com");
    expect((await db.newsletter.findOne((n) => n.email === "new.reader@example.com"))!.unsubscribedAt).toBeTruthy();
    expect(await newsletter.subscribe({ email: "new.reader@example.com", locale: "en", source: "footer" })).toEqual({ alreadySubscribed: false });
    expect((await db.newsletter.findOne((n) => n.email === "new.reader@example.com"))!.unsubscribedAt).toBeUndefined();

    await newsletter.subscribe({ email: "gone@example.com", locale: "en", source: "footer" });
    await newsletter.unsubscribe("gone@example.com");
    const csv = await newsletter.exportSubscribersCsv();
    expect(csv).toContain("new.reader@example.com");
    expect(csv).not.toContain("gone@example.com");
    expect(csv.split("\r\n")[0]).toBe("email,locale,source,subscribed_at");

    await expect(newsletter.subscribe({ email: "nope", locale: "en", source: "x" })).rejects.toMatchObject({ code: "validation_failed" });
    const found = await newsletter.listSubscribers({ q: "new.reader" });
    expect(found.total).toBe(1);
    await newsletter.deleteSubscriber(found.items[0]!.id, STAFF);
    expect(await newsletter.listSubscribers({ q: "new.reader" })).toMatchObject({ total: 0 });
    await expect(newsletter.deleteSubscriber("nws_missing", STAFF)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("contact", () => {
  it("stores the message, acknowledges the sender and notifies staff", async () => {
    const before = mail().length;
    const msg = await contact.submitMessage({ name: "Alex", email: "Alex@Example.com", subject: "Where is my order?", message: "I ordered last week and nothing arrived yet.", orderNumber: "AX-100450", locale: "en" });
    expect(msg).toMatchObject({ status: "new", email: "alex@example.com", orderNumber: "AX-100450" });
    const sent = mail().slice(before);
    expect(sent.map((m) => m.template).sort()).toEqual(["admin_contact", "contact_ack"]);
    expect(sent.find((m) => m.template === "contact_ack")!.to).toBe("alex@example.com");

    await expect(contact.submitMessage({ name: "", email: "bad", subject: "x", message: "short", locale: "en" })).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("lets staff triage and delete messages", async () => {
    const msg = (await contact.listMessages({ status: "new" })).items[0]!;
    const read = await contact.updateMessage(msg.id, { status: "read", adminNotes: "Called the customer" }, STAFF);
    expect(read).toMatchObject({ status: "read", adminNotes: "Called the customer" });
    await expect(contact.updateMessage(msg.id, { status: "weird" as never }, STAFF)).rejects.toMatchObject({ code: "validation_failed" });
    expect((await contact.listMessages({ status: "read" })).items.some((m) => m.id === msg.id)).toBe(true);
    expect((await contact.listMessages({ q: "called" })).total).toBe(0); // notes are not searched, message text is
    expect(await contact.getMessage(msg.id)).toMatchObject({ id: msg.id });
    await contact.deleteMessage(msg.id, STAFF);
    expect(await contact.getMessage(msg.id)).toBeNull();
  });
});

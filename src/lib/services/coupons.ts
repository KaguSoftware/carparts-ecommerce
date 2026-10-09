import "server-only";
import { z } from "zod";
import { zodFieldErrors } from "@/lib/action-result";
import { db } from "@/lib/db";
import { DomainError, notFound } from "@/lib/errors";
import type { Actor, Cents, Coupon, CouponApplication, Id, Paged } from "@/lib/types/domain";
import type { CouponInput } from "./contracts";
import { logAudit } from "./audit";
import { evaluateCoupon, normalizeCode, type CouponLine } from "./_coupon-rules";
import { diffFields, includesText, nowIso, paginate } from "./_shared";
import type { PageParams } from "@/lib/types/domain";

const localized = z.object({ en: z.string().trim().max(300, "too_long"), tr: z.string().trim().max(300, "too_long") });
const cents = z.number({ error: "number_invalid" }).int("integer_required").min(0, "must_not_be_negative").max(1_000_000_000, "too_large");
const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "date_invalid");

const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9_-]{3,32}$/, "invalid_value")),
    description: localized,
    type: z.enum(["percent", "fixed", "free_shipping"]),
    value: z.number({ error: "number_invalid" }).int("integer_required").min(0, "must_not_be_negative").max(1_000_000_000, "too_large"),
    minSubtotal: cents.optional(),
    maxDiscount: cents.optional(),
    startsAt: isoDate.optional(),
    endsAt: isoDate.optional(),
    usageLimit: z.number().int("integer_required").min(1, "must_be_positive").max(10_000_000).optional(),
    perUserLimit: z.number().int("integer_required").min(1, "must_be_positive").max(10_000).optional(),
    appliesTo: z
      .object({
        categoryIds: z.array(z.string()).max(200).optional(),
        brandIds: z.array(z.string()).max(200).optional(),
        productIds: z.array(z.string()).max(500).optional(),
      })
      .optional(),
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "percent" && (v.value < 1 || v.value > 100)) ctx.addIssue({ code: "custom", message: "invalid_value", path: ["value"] });
    if (v.type === "fixed" && v.value < 1) ctx.addIssue({ code: "custom", message: "must_be_positive", path: ["value"] });
    if (v.startsAt && v.endsAt && Date.parse(v.endsAt) <= Date.parse(v.startsAt)) ctx.addIssue({ code: "custom", message: "date_range_invalid", path: ["endsAt"] });
  });

function parse(input: unknown): z.output<typeof couponSchema> {
  const parsed = couponSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("validation_failed", { fieldErrors: zodFieldErrors(parsed.error) });
  return parsed.data;
}

async function assertScopeExists(appliesTo: Coupon["appliesTo"]) {
  if (!appliesTo) return;
  const [cats, brands, prods] = await Promise.all([
    db.categories.getMany(appliesTo.categoryIds ?? []),
    db.brands.getMany(appliesTo.brandIds ?? []),
    db.products.getMany(appliesTo.productIds ?? []),
  ]);
  if (cats.length !== (appliesTo.categoryIds ?? []).length || brands.length !== (appliesTo.brandIds ?? []).length || prods.length !== (appliesTo.productIds ?? []).length) {
    throw new DomainError("validation_failed", { fieldErrors: { appliesTo: ["invalid_value"] } });
  }
}

/** Counts earlier redemptions by this shopper (by account id and/or email). */
async function redemptionsBy(couponId: Id, who: { userId?: Id | null; email?: string }): Promise<number> {
  const email = who.email?.trim().toLowerCase();
  if (!who.userId && !email) return 0;
  return db.couponRedemptions.count((r) => r.couponId === couponId && ((who.userId && r.userId === who.userId) || (email && r.email.toLowerCase() === email) || false));
}

export async function validateCoupon(input: {
  code: string;
  lines: CouponLine[];
  subtotal: Cents;
  userId?: Id | null;
  email?: string;
}): Promise<CouponApplication> {
  const code = normalizeCode(input.code);
  if (!code || code.length > 40) throw new DomainError("coupon_invalid", { status: 409 });
  const coupon = await db.coupons.findOne((c) => c.code === code);
  if (!coupon) throw new DomainError("coupon_invalid", { status: 409 });

  const { discount, freeShipping } = evaluateCoupon(coupon, input.lines, input.subtotal);

  if (coupon.usageLimit !== undefined && coupon.usedCount >= coupon.usageLimit) throw new DomainError("coupon_used_up", { status: 409 });
  if (coupon.perUserLimit !== undefined) {
    const used = await redemptionsBy(coupon.id, { userId: input.userId, email: input.email });
    if (used >= coupon.perUserLimit) throw new DomainError("coupon_used_up", { status: 409 });
  }
  return { coupon, discount, freeShipping };
}

/**
 * Records one redemption (idempotent per order). Checkout calls it inside the order-creation transaction so the
 * redemption doubles as a reservation (released on failure/expiry/cancel). `force` skips the limit checks and is
 * only for an already-charged order whose hold was lost.
 */
export async function redeemCoupon(code: string, ctx: { orderId: Id; userId?: Id | null; email: string }, opts: { force?: boolean } = {}): Promise<void> {
  const normalized = normalizeCode(code);
  await db.transaction(async () => {
    const coupon = await db.coupons.findOne((c) => c.code === normalized);
    if (!coupon) throw new DomainError("coupon_invalid", { status: 409 });
    if (await db.couponRedemptions.findOne((r) => r.couponId === coupon.id && r.orderId === ctx.orderId)) return;
    if (!opts.force) {
      if (coupon.usageLimit !== undefined && coupon.usedCount >= coupon.usageLimit) throw new DomainError("coupon_used_up", { status: 409 });
      if (coupon.perUserLimit !== undefined && (await redemptionsBy(coupon.id, { userId: ctx.userId, email: ctx.email })) >= coupon.perUserLimit) {
        throw new DomainError("coupon_used_up", { status: 409 });
      }
    }
    await db.coupons.update(coupon.id, { usedCount: coupon.usedCount + 1, updatedAt: nowIso() });
    await db.couponRedemptions.insert({ couponId: coupon.id, orderId: ctx.orderId, userId: ctx.userId ?? null, email: ctx.email.trim().toLowerCase(), at: nowIso() });
  });
}

/** Reverses a redemption (order cancelled/refunded in full before use). Exported for orders service. */
export async function releaseCouponRedemption(orderId: Id): Promise<void> {
  await db.transaction(async () => {
    const redemption = await db.couponRedemptions.findOne((r) => r.orderId === orderId);
    if (!redemption) return;
    const coupon = await db.coupons.get(redemption.couponId);
    await db.couponRedemptions.delete(redemption.id);
    if (coupon) await db.coupons.update(coupon.id, { usedCount: Math.max(0, coupon.usedCount - 1), updatedAt: nowIso() });
  });
}

/* ------------------------------------------------------------------ admin */

type CouponStatus = "active" | "expired" | "scheduled" | "disabled";

export function couponStatus(c: Coupon, now = Date.now()): CouponStatus {
  if (!c.isActive) return "disabled";
  if (c.endsAt && Date.parse(c.endsAt) < now) return "expired";
  if (c.startsAt && Date.parse(c.startsAt) > now) return "scheduled";
  return "active";
}

export async function listCoupons(filter: PageParams & { q?: string; status?: CouponStatus | "all" } = {}): Promise<Paged<Coupon>> {
  const now = Date.now();
  const rows = await db.coupons.find({
    where: (c) => {
      if (filter.status && filter.status !== "all" && couponStatus(c, now) !== filter.status) return false;
      return filter.q ? includesText([c.code, c.description.en, c.description.tr], filter.q) : true;
    },
    orderBy: [{ field: "createdAt", direction: "desc" }],
  });
  return paginate(rows, filter, 25);
}

export async function getCoupon(id: Id): Promise<Coupon | null> {
  return db.coupons.get(id);
}

export async function createCoupon(input: CouponInput, actor: Actor): Promise<Coupon> {
  const data = parse(input);
  return db.transaction(async () => {
    await assertScopeExists(data.appliesTo);
    if (await db.coupons.findOne((c) => c.code === data.code)) throw new DomainError("code_taken", { status: 409 });
    const at = nowIso();
    const coupon = await db.coupons.insert({ ...stripUndefined(data), usedCount: 0, createdAt: at, updatedAt: at } as Omit<Coupon, "id">);
    await logAudit({ actor, action: "coupon.create", entityType: "coupon", entityId: coupon.id, summary: `Created coupon ${coupon.code}` });
    return coupon;
  });
}

export async function updateCoupon(id: Id, input: Partial<CouponInput>, actor: Actor): Promise<Coupon> {
  return db.transaction(async () => {
    const current = await db.coupons.get(id);
    if (!current) throw notFound("coupon");
    const { id: _id, usedCount: _used, createdAt: _c, updatedAt: _u, ...editable } = current;
    void _id;
    void _used;
    void _c;
    void _u;
    // Keys explicitly set to undefined clear optional limits.
    const merged = parse({ ...editable, ...input });
    await assertScopeExists(merged.appliesTo);
    if (await db.coupons.findOne((c) => c.id !== id && c.code === merged.code)) throw new DomainError("code_taken", { status: 409 });
    const clear: Partial<Record<keyof Coupon, undefined>> = {};
    for (const key of ["minSubtotal", "maxDiscount", "startsAt", "endsAt", "usageLimit", "perUserLimit", "appliesTo"] as const) {
      if ((merged as Record<string, unknown>)[key] === undefined) clear[key] = undefined;
    }
    const saved = await db.coupons.update(id, { ...clear, ...stripUndefined(merged), updatedAt: nowIso() } as Partial<Coupon>);
    await logAudit({
      actor,
      action: "coupon.update",
      entityType: "coupon",
      entityId: id,
      summary: `Updated coupon ${saved.code}`,
      changes: diffFields(current, saved, ["code", "type", "value", "minSubtotal", "maxDiscount", "startsAt", "endsAt", "usageLimit", "perUserLimit", "appliesTo", "isActive"]),
    });
    return saved;
  });
}

export async function deleteCoupon(id: Id, actor: Actor): Promise<void> {
  await db.transaction(async () => {
    const current = await db.coupons.get(id);
    if (!current) throw notFound("coupon");
    if (current.usedCount > 0) throw new DomainError("in_use", { status: 409 });
    await db.coupons.delete(id);
    await logAudit({ actor, action: "coupon.delete", entityType: "coupon", entityId: id, summary: `Deleted coupon ${current.code}` });
  });
}

function stripUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

import { freshSeed, STAFF } from "../helpers/test-env";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import * as coupons from "@/lib/services/coupons";
import { evaluateCoupon, lineInScope } from "@/lib/services/_coupon-rules";
import type { Coupon } from "@/lib/types/domain";

const BRAKES = "cat_brakes";
const lines = (...entries: { amount: number; categories?: string[]; brand?: string; product?: string }[]) =>
  entries.map((e, i) => ({ productId: e.product ?? `prd_${i}`, brandId: e.brand ?? "brd_x", categoryIds: e.categories ?? ["cat_other"], lineTotal: e.amount }));

const base: Coupon = {
  id: "cpn_t",
  code: "T",
  description: { en: "", tr: "" },
  type: "percent",
  value: 10,
  usedCount: 0,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("coupon rules (pure)", () => {
  it("percent: rounds half away from zero and respects maxDiscount", () => {
    expect(evaluateCoupon({ ...base, value: 15 }, lines({ amount: 1001 }), 1001).discount).toBe(150); // 150.15 -> 150
    expect(evaluateCoupon({ ...base, value: 15 }, lines({ amount: 1003 }), 1003).discount).toBe(150); // 150.45
    expect(evaluateCoupon({ ...base, value: 15 }, lines({ amount: 1004 }), 1004).discount).toBe(151); // 150.6
    expect(evaluateCoupon({ ...base, value: 50, maxDiscount: 4000 }, lines({ amount: 20000 }), 20000).discount).toBe(4000);
  });

  it("fixed: never exceeds the eligible subtotal", () => {
    expect(evaluateCoupon({ ...base, type: "fixed", value: 2500 }, lines({ amount: 1800 }), 1800).discount).toBe(1800);
    expect(evaluateCoupon({ ...base, type: "fixed", value: 2500 }, lines({ amount: 9000 }), 9000).discount).toBe(2500);
  });

  it("free_shipping: no discount, flags free shipping", () => {
    const r = evaluateCoupon({ ...base, type: "free_shipping", value: 0 }, lines({ amount: 5000 }), 5000);
    expect(r).toMatchObject({ discount: 0, freeShipping: true });
  });

  it("minimum spend is checked against the whole cart and reports the amount", () => {
    expect(() => evaluateCoupon({ ...base, minSubtotal: 15000 }, lines({ amount: 14999 }), 14999)).toThrowError(
      expect.objectContaining({ code: "coupon_min_subtotal", params: { min: 15000 } }),
    );
    expect(evaluateCoupon({ ...base, minSubtotal: 15000 }, lines({ amount: 15000 }), 15000).discount).toBe(1500);
  });

  it("schedule: not started, expired, boundaries and inactive", () => {
    const now = new Date("2026-06-15T12:00:00.000Z");
    const at = (iso: string) => ({ startsAt: iso });
    expect(() => evaluateCoupon({ ...base, ...at("2026-06-15T12:00:01.000Z") }, lines({ amount: 100 }), 100, now)).toThrowError(expect.objectContaining({ code: "coupon_not_started" }));
    expect(() => evaluateCoupon({ ...base, endsAt: "2026-06-15T11:59:59.000Z" }, lines({ amount: 100 }), 100, now)).toThrowError(expect.objectContaining({ code: "coupon_expired" }));
    expect(evaluateCoupon({ ...base, startsAt: "2026-06-15T12:00:00.000Z", endsAt: "2026-06-15T12:00:00.000Z" }, lines({ amount: 100 }), 100, now).discount).toBe(10);
    expect(() => evaluateCoupon({ ...base, isActive: false }, lines({ amount: 100 }), 100, now)).toThrowError(expect.objectContaining({ code: "coupon_invalid" }));
  });

  it("scope: only matching lines count towards the discount; no match is not_applicable", () => {
    const scoped: Coupon = { ...base, value: 20, appliesTo: { categoryIds: [BRAKES] } };
    const cart = lines({ amount: 10000, categories: [BRAKES, "cat_x"] }, { amount: 30000, categories: ["cat_engine"] });
    const r = evaluateCoupon(scoped, cart, 40000);
    expect(r.discount).toBe(2000);
    expect(r.eligibleAmounts).toEqual([10000, 0]);
    expect(() => evaluateCoupon(scoped, lines({ amount: 5000, categories: ["cat_engine"] }), 5000)).toThrowError(expect.objectContaining({ code: "coupon_not_applicable" }));

    expect(lineInScope({ appliesTo: { brandIds: ["brd_a"] } }, lines({ amount: 1, brand: "brd_a" })[0]!)).toBe(true);
    expect(lineInScope({ appliesTo: { productIds: ["prd_z"] } }, lines({ amount: 1 })[0]!)).toBe(false);
    expect(lineInScope({ appliesTo: { categoryIds: [] } }, lines({ amount: 1 })[0]!)).toBe(true); // empty scope = everything
  });

  it("never discounts more than the cart subtotal", () => {
    expect(evaluateCoupon({ ...base, value: 100 }, lines({ amount: 700 }), 700).discount).toBe(700);
  });
});

describe("coupon service (usage limits, redemption, admin)", () => {
  beforeAll(async () => {
    await freshSeed();
  }, 60_000);

  const input = (extra: Partial<Parameters<typeof coupons.createCoupon>[0]> = {}) => ({
    code: "TEST15",
    description: { en: "Test", tr: "Test" },
    type: "percent" as const,
    value: 15,
    isActive: true,
    ...extra,
  });
  const cart = (amount: number) => ({ lines: lines({ amount }), subtotal: amount });

  it("validates codes case-insensitively and rejects unknown ones", async () => {
    const ok = await coupons.validateCoupon({ code: " welcome10 ", ...cart(10000), email: "new@example.com" });
    expect(ok.coupon.code).toBe("WELCOME10");
    expect(ok.discount).toBe(1000);
    await expect(coupons.validateCoupon({ code: "NOPE", ...cart(100) })).rejects.toMatchObject({ code: "coupon_invalid" });
    await expect(coupons.validateCoupon({ code: "", ...cart(100) })).rejects.toMatchObject({ code: "coupon_invalid" });
    await expect(coupons.validateCoupon({ code: "OLDDEAL", ...cart(100) })).rejects.toMatchObject({ code: "coupon_invalid" }); // disabled
    await expect(coupons.validateCoupon({ code: "SPRING20", ...cart(100) })).rejects.toMatchObject({ code: "coupon_expired" });
    await expect(coupons.validateCoupon({ code: "SAVE25", ...cart(14000) })).rejects.toMatchObject({ code: "coupon_min_subtotal" });
  });

  it("enforces total and per-user usage limits (by account or email)", async () => {
    await expect(coupons.validateCoupon({ code: "FLASH30", ...cart(5000) })).rejects.toMatchObject({ code: "coupon_used_up" }); // 40/40 used in the seed

    // WELCOME10 allows one use per shopper
    const first = await coupons.validateCoupon({ code: "WELCOME10", ...cart(5000), userId: "usr_c06", email: "noor.haddad@mail.example" });
    expect(first.discount).toBe(500);
    await coupons.redeemCoupon("WELCOME10", { orderId: "ord_test_1", userId: "usr_c06", email: "noor.haddad@mail.example" });
    await expect(coupons.validateCoupon({ code: "WELCOME10", ...cart(5000), userId: "usr_c06" })).rejects.toMatchObject({ code: "coupon_used_up" });
    await expect(coupons.validateCoupon({ code: "WELCOME10", ...cart(5000), email: "NOOR.HADDAD@mail.example" })).rejects.toMatchObject({ code: "coupon_used_up" });
    // someone else is fine
    await expect(coupons.validateCoupon({ code: "WELCOME10", ...cart(5000), userId: "usr_c07", email: "carlos.ortega@mail.example" })).resolves.toBeTruthy();
  });

  it("redeemCoupon is idempotent per order, honours limits and can be forced after payment", async () => {
    const before = (await db.coupons.findOne((c) => c.code === "VIP20"))!;
    await coupons.redeemCoupon("VIP20", { orderId: "ord_test_2", email: "a@example.com" });
    await coupons.redeemCoupon("VIP20", { orderId: "ord_test_2", email: "a@example.com" }); // replay
    expect((await db.coupons.findOne((c) => c.code === "VIP20"))!.usedCount).toBe(before.usedCount + 1);
    expect(await db.couponRedemptions.count((r) => r.orderId === "ord_test_2")).toBe(1);

    await db.coupons.update(before.id, { usageLimit: before.usedCount + 1 });
    await expect(coupons.redeemCoupon("VIP20", { orderId: "ord_test_3", email: "b@example.com" })).rejects.toMatchObject({ code: "coupon_used_up" });
    await coupons.redeemCoupon("VIP20", { orderId: "ord_test_3", email: "b@example.com" }, { force: true });
    expect((await db.coupons.findOne((c) => c.code === "VIP20"))!.usedCount).toBe(before.usedCount + 2);

    await coupons.releaseCouponRedemption("ord_test_3");
    expect((await db.coupons.findOne((c) => c.code === "VIP20"))!.usedCount).toBe(before.usedCount + 1);
  });

  it("creates, updates, filters and deletes coupons with validation and audit", async () => {
    const created = await coupons.createCoupon(input(), STAFF);
    expect(created).toMatchObject({ code: "TEST15", usedCount: 0, type: "percent" });
    await expect(coupons.createCoupon(input({ code: "test15" }), STAFF)).rejects.toMatchObject({ code: "code_taken" });
    await expect(coupons.createCoupon(input({ code: "BAD1", value: 150 }), STAFF)).rejects.toMatchObject({ code: "validation_failed", fieldErrors: { value: ["invalid_value"] } });
    await expect(coupons.createCoupon(input({ code: "BAD2", startsAt: "2026-02-01T00:00:00Z", endsAt: "2026-01-01T00:00:00Z" }), STAFF)).rejects.toMatchObject({ fieldErrors: { endsAt: ["date_range_invalid"] } });
    await expect(coupons.createCoupon(input({ code: "BAD3", appliesTo: { categoryIds: ["cat_nope"] } }), STAFF)).rejects.toMatchObject({ code: "validation_failed" });
    await expect(coupons.createCoupon(input({ code: "x y" }), STAFF)).rejects.toMatchObject({ code: "validation_failed" });

    const updated = await coupons.updateCoupon(created.id, { value: 20, maxDiscount: 3000, isActive: false }, STAFF);
    expect(updated).toMatchObject({ value: 20, maxDiscount: 3000, isActive: false });
    const cleared = await coupons.updateCoupon(created.id, { maxDiscount: undefined }, STAFF);
    expect(cleared.maxDiscount).toBeUndefined();

    const disabled = await coupons.listCoupons({ status: "disabled" });
    expect(disabled.items.some((c) => c.id === created.id)).toBe(true);
    expect((await coupons.listCoupons({ status: "expired" })).items.every((c) => c.endsAt && Date.parse(c.endsAt) < Date.now())).toBe(true);
    expect((await coupons.listCoupons({ status: "scheduled" })).items.every((c) => c.startsAt && Date.parse(c.startsAt) > Date.now())).toBe(true);
    expect((await coupons.listCoupons({ q: "brakes" })).items.map((c) => c.code)).toContain("BRAKES15");

    const used = (await db.coupons.findOne((c) => c.code === "WELCOME10"))!;
    await expect(coupons.deleteCoupon(used.id, STAFF)).rejects.toMatchObject({ code: "in_use" });
    await coupons.deleteCoupon(created.id, STAFF);
    expect(await coupons.getCoupon(created.id)).toBeNull();
    expect((await db.auditLog.find({ where: (a) => a.entityId === created.id })).map((a) => a.action)).toEqual(expect.arrayContaining(["coupon.create", "coupon.update", "coupon.delete"]));
  });
});

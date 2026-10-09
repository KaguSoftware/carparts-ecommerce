import { ADMIN, freshSeed, STAFF } from "../helpers/test-env";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import * as audit from "@/lib/services/audit";
import * as banners from "@/lib/services/banners";
import * as cms from "@/lib/services/cms";
import * as dashboard from "@/lib/services/dashboard";
import * as settings from "@/lib/services/settings";
import * as shipping from "@/lib/services/shipping";
import * as tax from "@/lib/services/tax";
import { matchTaxRate } from "@/lib/services/tax";
import { priceMethod } from "@/lib/services/shipping";
import { convertFromBase, convertToBase, formatMoney } from "@/lib/money";

beforeAll(async () => {
  await freshSeed();
}, 60_000);

describe("settings", () => {
  it("exposes public settings without private fields and a currency context per locale", async () => {
    const pub = await settings.getPublicSettings();
    expect(pub).toHaveProperty("tryPerUsd", 45);
    expect(JSON.stringify(pub)).not.toContain("taxId");
    expect(JSON.stringify(pub)).not.toContain("adminAddress");
    expect(await settings.getCurrencyContext("en")).toEqual({ currency: "USD", rate: 1 });
    expect(await settings.getCurrencyContext("tr")).toEqual({ currency: "TRY", rate: 45 });
  });

  it("converts at the presentation edge only (USD cents <-> display currency)", async () => {
    const tr = await settings.getCurrencyContext("tr");
    expect(convertFromBase(1999, tr)).toBe(89955);
    expect(convertToBase(89955, tr)).toBe(1999);
    expect(formatMoney(1999, "en")).toBe("$19.99");
    expect(formatMoney(1999, "tr", tr)).toMatch(/899,55/);
  });

  it("validates, merges deeply, ignores the order counter and audits the diff", async () => {
    const before = await settings.getSettings();
    const next = await settings.updateSettings({ currency: { tryPerUsd: 50 }, checkout: { maxQuantityPerLine: 8, freeShippingThreshold: 12000 }, social: { instagram: "https://instagram.com/test" } }, ADMIN);
    expect(next.currency.tryPerUsd).toBe(50);
    expect(next.checkout).toMatchObject({ maxQuantityPerLine: 8, freeShippingThreshold: 12000, orderNumberPrefix: before.checkout.orderNumberPrefix, nextOrderNumber: before.checkout.nextOrderNumber });
    expect(next.store.name).toBe(before.store.name);
    expect((await settings.getCurrencyContext("tr")).rate).toBe(50);

    const sneaky = await settings.updateSettings({ checkout: { nextOrderNumber: 1 } } as never, ADMIN);
    expect(sneaky.checkout.nextOrderNumber).toBe(before.checkout.nextOrderNumber);

    await expect(settings.updateSettings({ currency: { tryPerUsd: -1 } }, ADMIN)).rejects.toMatchObject({ code: "validation_failed", fieldErrors: { "currency.tryPerUsd": ["must_be_positive"] } });
    await expect(settings.updateSettings({ checkout: { defaultCountry: "JP" } }, ADMIN)).rejects.toMatchObject({ code: "validation_failed" });
    await expect(settings.updateSettings({ store: { email: "not-mail" } }, ADMIN)).rejects.toMatchObject({ code: "validation_failed" });
    await expect(settings.updateSettings({ checkout: { orderNumberPrefix: "bad prefix!" } }, ADMIN)).rejects.toMatchObject({ code: "validation_failed" });

    const entry = (await db.auditLog.find({ where: (a) => a.action === "settings.update", orderBy: [{ field: "at", direction: "desc" }] }))[0]!;
    expect(entry.changes?.["currency.tryPerUsd"]).toEqual({ from: 45, to: 50 });
    await settings.updateSettings({ currency: { tryPerUsd: 45 }, checkout: { maxQuantityPerLine: 10, freeShippingThreshold: 9900 } }, ADMIN);
  });

  it("hands out unique, sequential order numbers even under concurrency", async () => {
    const current = (await settings.getSettings()).checkout;
    const numbers = await Promise.all(Array.from({ length: 12 }, () => settings.allocateOrderNumber()));
    expect(new Set(numbers).size).toBe(12);
    const values = numbers.map((n) => Number(n.replace(current.orderNumberPrefix, ""))).sort((a, b) => a - b);
    expect(values[0]).toBe(current.nextOrderNumber);
    expect(values.at(-1)).toBe(current.nextOrderNumber + 11);
    expect((await settings.getSettings()).checkout.nextOrderNumber).toBe(current.nextOrderNumber + 12);
    // a counter that fell behind existing orders skips ahead
    await db.settings.update("settings", { checkout: { ...(await settings.getSettings()).checkout, nextOrderNumber: 100450 } });
    expect(await settings.allocateOrderNumber()).toBe("AX-100487");
  });
});

describe("tax", () => {
  it("picks the most specific rate and honours appliesToShipping", async () => {
    const rates = await tax.listTaxRates();
    expect(matchTaxRate(rates, "US", "TX")?.rateBps).toBe(625);
    expect(matchTaxRate(rates, "us", " tx ")?.rateBps).toBe(625);
    expect(matchTaxRate(rates, "TR", "")?.rateBps).toBe(2000);
    expect(matchTaxRate(rates, "TR", "Ankara")?.rateBps).toBe(2000); // unknown region falls back to the country rate
    expect(matchTaxRate(rates, "JP", "")).toBeUndefined();
    expect(matchTaxRate(rates, "US", "")).toBeUndefined(); // US has only state rates

    const withShippingTax = await tax.calculateTax({ country: "US", region: "TX", taxableSubtotal: 10000, shipping: 1000 });
    expect(withShippingTax.tax).toBe(Math.round(11000 * 0.0625)); // Texas taxes shipping
    const noShippingTax = await tax.calculateTax({ country: "US", region: "MI", taxableSubtotal: 10000, shipping: 1000 });
    expect(noShippingTax.tax).toBe(600);
    expect((await tax.calculateTax({ country: "JP", region: "", taxableSubtotal: 10000, shipping: 0 })).tax).toBe(0);
    expect((await tax.calculateTax({ country: "GB", region: "England", taxableSubtotal: 0, shipping: 0 })).tax).toBe(0);
  });

  it("splits order tax across lines without losing a cent", () => {
    const parts = tax.allocateTax([3333, 3333, 3334], 100);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
    expect(tax.allocateTax([0, 0], 5)).toEqual([0, 0]);
    expect(tax.allocateTax([100], 7)).toEqual([7]);
  });

  it("manages rates with validation and uniqueness", async () => {
    const rate = await tax.createTaxRate({ name: { en: "Sales tax (OR)", tr: "Satış vergisi (OR)" }, country: "us", region: "OR", rateBps: 0, appliesToShipping: false, isActive: true }, ADMIN);
    expect(rate.country).toBe("US");
    await expect(tax.createTaxRate({ name: { en: "Dup", tr: "" }, country: "US", region: "or", rateBps: 100, appliesToShipping: false, isActive: true }, ADMIN)).rejects.toMatchObject({ code: "conflict" });
    await expect(tax.createTaxRate({ name: { en: "Bad", tr: "" }, country: "US", region: "ZZ", rateBps: 20000, appliesToShipping: false, isActive: true }, ADMIN)).rejects.toMatchObject({ code: "validation_failed" });
    const updated = await tax.updateTaxRate(rate.id, { rateBps: 450 }, ADMIN);
    expect(updated.rateBps).toBe(450);
    expect((await tax.calculateTax({ country: "US", region: "OR", taxableSubtotal: 20000, shipping: 0 })).tax).toBe(900);
    await tax.updateTaxRate(rate.id, { isActive: false }, ADMIN);
    expect((await tax.calculateTax({ country: "US", region: "OR", taxableSubtotal: 20000, shipping: 0 })).tax).toBe(0);
    await tax.deleteTaxRate(rate.id, ADMIN);
    await expect(tax.deleteTaxRate(rate.id, ADMIN)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("shipping", () => {
  it("quotes methods per country with weight surcharges and free thresholds", async () => {
    const light = await shipping.getQuotes({ country: "US", subtotal: 5000, totalWeightGrams: 800 });
    expect(light.map((q) => q.code)).toEqual(["standard", "express", "pickup"]);
    expect(light[0]).toMatchObject({ price: 799, isFree: false });
    expect(light[2]).toMatchObject({ price: 0, isFree: true });

    const heavy = await shipping.getQuotes({ country: "US", subtotal: 5000, totalWeightGrams: 4500 }); // 4 full kg above the first
    expect(heavy.find((q) => q.code === "standard")!.price).toBe(799 + 150 * 3);
    expect(heavy.find((q) => q.code === "express")!.price).toBe(1999 + 250 * 3);

    const big = await shipping.getQuotes({ country: "US", subtotal: 9900, totalWeightGrams: 4500 });
    expect(big.find((q) => q.code === "standard")).toMatchObject({ price: 0, isFree: true }); // free over $99
    expect(big.find((q) => q.code === "express")!.price).toBeGreaterThan(0);

    const coupon = await shipping.getQuotes({ country: "US", subtotal: 100, totalWeightGrams: 3000, freeShippingCoupon: true });
    expect(coupon.every((q) => q.price === 0 && q.isFree)).toBe(true);

    expect((await shipping.getQuotes({ country: "TR", subtotal: 1000, totalWeightGrams: 500 })).map((q) => q.code)).toEqual(["tr-standard", "tr-express"]);
    expect(await shipping.getQuotes({ country: "JP", subtotal: 1000, totalWeightGrams: 500 })).toEqual([]);
  });

  it("getQuote throws for inactive or non-serving methods", async () => {
    await expect(shipping.getQuote("shp_tr_standard", { country: "US", subtotal: 100, totalWeightGrams: 100 })).rejects.toMatchObject({ code: "shipping_unavailable" });
    await expect(shipping.getQuote("shp_missing", { country: "US", subtotal: 100, totalWeightGrams: 100 })).rejects.toMatchObject({ code: "shipping_unavailable" });
    expect((await shipping.getQuote("shp_express", { country: "US", subtotal: 100, totalWeightGrams: 100 })).price).toBe(1999);
    const method = (await db.shippingMethods.get("shp_standard"))!;
    expect(priceMethod(method, { country: "US", subtotal: 9899, totalWeightGrams: 0 }).price).toBe(799);
    expect(priceMethod(method, { country: "US", subtotal: 9900, totalWeightGrams: 0 }).price).toBe(0);
  });

  it("manages methods with unique codes and range checks", async () => {
    const input = { code: "drone", name: { en: "Drone", tr: "Drone" }, description: { en: "Fast", tr: "Hızlı" }, countries: ["us"], price: 2500, perKgPrice: 0, estimatedDaysMin: 0, estimatedDaysMax: 1, isActive: true, sortOrder: 9 };
    const created = await shipping.createShippingMethod(input, ADMIN);
    expect(created.countries).toEqual(["US"]);
    await expect(shipping.createShippingMethod(input, ADMIN)).rejects.toMatchObject({ code: "code_taken" });
    await expect(shipping.createShippingMethod({ ...input, code: "bad", estimatedDaysMin: 5, estimatedDaysMax: 2 }, ADMIN)).rejects.toMatchObject({ code: "validation_failed" });
    await expect(shipping.createShippingMethod({ ...input, code: "bad2", price: -1 }, ADMIN)).rejects.toMatchObject({ code: "validation_failed" });
    const updated = await shipping.updateShippingMethod(created.id, { price: 3000, freeOverSubtotal: 20000 }, ADMIN);
    expect(updated).toMatchObject({ price: 3000, freeOverSubtotal: 20000 });
    expect((await shipping.updateShippingMethod(created.id, { freeOverSubtotal: undefined }, ADMIN)).freeOverSubtotal).toBeUndefined();
    await shipping.updateShippingMethod(created.id, { isActive: false }, ADMIN);
    expect((await shipping.getQuotes({ country: "US", subtotal: 1, totalWeightGrams: 1 })).some((q) => q.code === "drone")).toBe(false);
    expect((await shipping.listShippingMethods()).some((m) => m.id === created.id)).toBe(true);
    await shipping.deleteShippingMethod(created.id, ADMIN);
    await expect(shipping.deleteShippingMethod(created.id, ADMIN)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("cms pages and banners", () => {
  it("serves only published pages publicly and validates slugs", async () => {
    const footer = await cms.listFooterPages();
    expect(footer.length).toBeGreaterThan(0);
    const about = (await cms.getPageBySlug("about"))!;
    expect(about.isPublished).toBe(true);
    const page = await cms.createPage({ slug: "warranty-info", title: { en: "Warranty", tr: "Garanti" }, body: { en: "# Warranty\n\nText", tr: "" }, isPublished: false, showInFooter: true, sortOrder: 50 }, STAFF);
    expect(await cms.getPageBySlug("warranty-info")).toBeNull();
    expect((await cms.getPageBySlug("warranty-info", { includeUnpublished: true }))?.id).toBe(page.id);
    expect(footer.map((p) => p.slug)).not.toContain("warranty-info");
    await cms.updatePage(page.id, { isPublished: true }, STAFF);
    expect((await cms.listFooterPages()).map((p) => p.slug)).toContain("warranty-info");
    expect((await cms.listPublishedSlugs()).map((p) => p.slug)).toContain("warranty-info");

    await expect(cms.createPage({ slug: "about", title: { en: "x", tr: "" }, body: { en: "x", tr: "" }, isPublished: true, showInFooter: false, sortOrder: 1 }, STAFF)).rejects.toMatchObject({ code: "slug_taken" });
    await expect(cms.createPage({ slug: "Bad Slug", title: { en: "x", tr: "" }, body: { en: "x", tr: "" }, isPublished: true, showInFooter: false, sortOrder: 1 }, STAFF)).rejects.toMatchObject({ code: "validation_failed" });
    await expect(cms.updatePage(page.id, { slug: "about" }, STAFF)).rejects.toMatchObject({ code: "slug_taken" });
    await expect(cms.updatePage(page.id, { title: { en: "", tr: "" } }, STAFF)).rejects.toMatchObject({ code: "validation_failed" });
    await cms.deletePage(page.id, STAFF);
    expect(await cms.getPageById(page.id)).toBeNull();
    expect((await cms.listPages()).length).toBeGreaterThan(3);
  });

  it("shows banners only inside their schedule and keeps them ordered", async () => {
    const now = new Date("2026-06-15T12:00:00Z");
    const base = { placement: "announcement" as const, title: { en: "Sale", tr: "İndirim" }, subtitle: { en: "", tr: "" }, ctaLabel: { en: "Shop", tr: "Alışveriş" }, ctaHref: "/deals", tone: "orange" as const, isActive: true, sortOrder: 5 };
    const live = await banners.createBanner({ ...base, startsAt: "2026-06-01T00:00:00Z", endsAt: "2026-06-30T00:00:00Z" }, STAFF);
    const future = await banners.createBanner({ ...base, title: { en: "Soon", tr: "Yakında" }, startsAt: "2026-07-01T00:00:00Z", sortOrder: 1 }, STAFF);
    const expired = await banners.createBanner({ ...base, title: { en: "Old", tr: "Eski" }, endsAt: "2026-06-10T00:00:00Z" }, STAFF);
    const disabled = await banners.createBanner({ ...base, title: { en: "Off", tr: "Kapalı" }, isActive: false }, STAFF);
    const ids = (await banners.getActiveBanners("announcement", now)).map((b) => b.id);
    expect(ids).toContain(live.id);
    for (const hidden of [future, expired, disabled]) expect(ids).not.toContain(hidden.id);
    expect((await banners.getActiveBanners("announcement", new Date("2026-07-02T00:00:00Z"))).map((b) => b.id)).toContain(future.id);

    await expect(banners.createBanner({ ...base, ctaHref: "javascript:alert(1)" }, STAFF)).rejects.toMatchObject({ code: "validation_failed", fieldErrors: { ctaHref: ["url_invalid"] } });
    await expect(banners.createBanner({ ...base, ctaHref: "//evil.example" }, STAFF)).rejects.toMatchObject({ code: "validation_failed" });
    await expect(banners.createBanner({ ...base, startsAt: "2026-06-10T00:00:00Z", endsAt: "2026-06-01T00:00:00Z" }, STAFF)).rejects.toMatchObject({ code: "validation_failed" });

    const updated = await banners.updateBanner(live.id, { endsAt: undefined, sortOrder: 0 }, STAFF);
    expect(updated.endsAt).toBeUndefined();
    expect((await banners.getBanner(live.id))?.sortOrder).toBe(0);
    for (const b of [live, future, expired, disabled]) await banners.deleteBanner(b.id, STAFF);
    expect((await banners.listBanners()).some((b) => b.id === live.id)).toBe(false);
  });
});

describe("audit log and dashboard", () => {
  it("filters, searches and paginates the audit log, newest first", async () => {
    await audit.logAudit({ actor: ADMIN, action: "product.update", entityType: "product", entityId: "prd_x", summary: "Updated Brake Disc", changes: { price: { from: 1, to: 2 } } });
    await audit.logAudit({ actor: STAFF, action: "order.refund", entityType: "order", entityId: "ord_x", summary: "Refunded $5" });
    const all = await audit.listAudit({ pageSize: 5 });
    expect(all.items).toHaveLength(5);
    const dates = all.items.map((e) => e.at);
    expect(dates).toEqual([...dates].sort().reverse());
    expect((await audit.listAudit({ action: "order.refund" })).items.every((e) => e.action === "order.refund")).toBe(true);
    expect((await audit.listAudit({ action: "product.*" })).items.every((e) => e.action.startsWith("product."))).toBe(true);
    expect((await audit.listAudit({ q: "brake disc" })).items[0]?.entityId).toBe("prd_x");
    expect((await audit.listAudit({ actorId: STAFF.id, entityType: "order" })).items.every((e) => e.actor.id === STAFF.id)).toBe(true);
    expect((await audit.listAudit({ from: new Date(Date.now() + 3_600_000).toISOString() })).total).toBe(0);
    const long = await audit.logAudit({ actor: ADMIN, action: "x.y", entityType: "x", entityId: "1", summary: "s".repeat(1000) });
    expect(long.summary.length).toBe(300);
  });

  it("computes dashboard stats from paid orders, net of refunds", async () => {
    const stats = await dashboard.getDashboardStats({ days: 90 });
    const counted = (await db.orders.all()).filter((o) => ["paid", "partially_refunded", "refunded"].includes(o.paymentStatus) && Date.parse(o.createdAt) >= Date.parse(stats.range.from));
    expect(stats.orders.total).toBe(counted.length);
    expect(stats.revenue.total).toBe(counted.reduce((s, o) => s + o.total - o.refundedTotal, 0));
    expect(stats.averageOrderValue).toBe(Math.round(stats.revenue.total / counted.length));
    expect(stats.series.reduce((s, p) => s + p.revenue, 0)).toBe(stats.revenue.total);
    expect(stats.series.reduce((s, p) => s + p.orders, 0)).toBe(counted.length);
    expect(Object.keys(stats.orders.byStatus).sort()).toEqual(["cancelled", "delivered", "pending_payment", "processing", "refunded", "shipped"]);
    expect(stats.topProducts.length).toBeLessThanOrEqual(5);
    const units = stats.topProducts.map((p) => p.unitsSold);
    expect(units).toEqual([...units].sort((a, b) => b - a));
    expect(stats.recentOrders).toHaveLength(8);
    expect(stats.lowStock.length).toBeGreaterThan(0);
    expect(stats.pendingReviews).toBe(await db.reviews.count((r) => r.status === "pending"));
    expect(stats.customers.total).toBe(await db.users.count((u) => u.role === "customer"));
    const week = await dashboard.getDashboardStats({ days: 7 });
    expect(week.series.length).toBeGreaterThanOrEqual(7);
    expect(week.revenue.total).toBeLessThanOrEqual(stats.revenue.total);
  });

  it("builds sales reports grouped by day, week and month that reconcile", async () => {
    const from = new Date(Date.now() - 80 * 86_400_000).toISOString();
    const to = new Date().toISOString();
    const daily = await dashboard.getSalesReport({ from, to, groupBy: "day" });
    const weekly = await dashboard.getSalesReport({ from, to, groupBy: "week" });
    const monthly = await dashboard.getSalesReport({ from, to, groupBy: "month" });
    const total = (rows: typeof daily) => rows.reduce((s, r) => s + r.revenue, 0);
    expect(total(weekly)).toBe(total(daily));
    expect(total(monthly)).toBe(total(daily));
    expect(weekly.every((r) => new Date(`${r.period}T00:00:00Z`).getUTCDay() === 1)).toBe(true); // weeks start on Monday
    expect(monthly.every((r) => /^\d{4}-\d{2}$/.test(r.period))).toBe(true);
    expect(daily.map((r) => r.period)).toEqual([...daily.map((r) => r.period)].sort());
    for (const row of daily) expect(row.averageOrderValue).toBe(Math.round(row.revenue / row.orders));
  });
});

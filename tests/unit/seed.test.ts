import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { verifyPassword } from "better-auth/crypto";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { COLLECTION_NAMES, type SeedData } from "@/lib/db/collections";
import { createJsonDatabase } from "@/lib/db/json/database";
import { buildSeed, SEED_CREDENTIALS } from "@/lib/db/seed";
import { buildCatalog } from "@/lib/db/seed/catalog/build";
import { buildVehicles, VEHICLE_CONFIGS } from "@/lib/db/seed/vehicles";
import { makeClock } from "@/lib/db/seed/util";
import { collectionSchemas } from "@/lib/types/schemas";

let seed: SeedData;

beforeAll(async () => {
  seed = await buildSeed();
}, 60_000);

const unique = (values: string[]) => new Set(values).size === values.length;
const ids = (rows: { id: string }[]) => new Set(rows.map((r) => r.id));

describe("seed schema", () => {
  it("covers every collection", () => {
    expect(Object.keys(seed).sort()).toEqual([...COLLECTION_NAMES].sort());
  });

  for (const name of COLLECTION_NAMES) {
    it(`${name}: every row satisfies its zod schema and ids are unique`, () => {
      const rows = seed[name] as { id: string }[];
      const schema = collectionSchemas[name];
      const failures: string[] = [];
      for (const row of rows) {
        const result = schema.safeParse(row);
        if (!result.success) failures.push(`${row.id}: ${result.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
      }
      expect(failures.slice(0, 5)).toEqual([]);
      expect(unique(rows.map((r) => r.id))).toBe(true);
    });
  }
});

describe("seed content", () => {
  it("has the catalogue shape from the plan", () => {
    const top = seed.categories.filter((c) => c.parentId === null);
    expect(top.map((c) => c.slug)).toEqual(["brakes", "engine", "suspension", "filters", "lighting", "electrical", "exhaust", "cooling", "body", "fluids"]);
    expect(seed.categories.length).toBeGreaterThan(40);
    expect(seed.brands.length).toBeGreaterThanOrEqual(25);
    expect(seed.products.length).toBeGreaterThanOrEqual(115);
    expect(seed.products.filter((p) => p.status === "active").length).toBeGreaterThanOrEqual(110);
    expect(seed.products.some((p) => p.status === "draft")).toBe(true);
    expect(seed.products.some((p) => p.status === "archived")).toBe(true);
    expect(VEHICLE_CONFIGS.length).toBeGreaterThanOrEqual(40);
    expect(seed.orders.length).toBeGreaterThanOrEqual(30);
    expect(new Set(seed.orders.map((o) => o.status))).toEqual(new Set(["pending_payment", "processing", "shipped", "delivered", "cancelled", "refunded"]));
    expect(seed.orders.some((o) => o.paymentStatus === "partially_refunded")).toBe(true);
    expect(seed.orders.some((o) => o.paymentStatus === "failed")).toBe(true);
    expect(seed.orders.some((o) => o.currency === "TRY")).toBe(true);
    expect(seed.reviews.length).toBeGreaterThan(150);
    expect(seed.reviews.some((r) => r.status === "pending")).toBe(true);
    expect(seed.pages.map((p) => p.slug).sort()).toEqual(["about", "faq", "privacy", "returns", "shipping", "terms"]);
  });

  it("gives every product 1-3 variants with exactly one default, bilingual text and images", () => {
    const byProduct = new Map<string, typeof seed.variants>();
    for (const v of seed.variants) byProduct.set(v.productId, [...(byProduct.get(v.productId) ?? []), v]);
    for (const p of seed.products) {
      const vs = byProduct.get(p.id) ?? [];
      expect(vs.length, p.slug).toBeGreaterThanOrEqual(1);
      expect(vs.length, p.slug).toBeLessThanOrEqual(3);
      expect(vs.filter((v) => v.isDefault).length, p.slug).toBe(1);
      expect(p.images.length, p.slug).toBeGreaterThanOrEqual(2);
      expect(p.specs.length, p.slug).toBeGreaterThanOrEqual(4);
      for (const field of [p.name, p.summary, p.description]) {
        expect(field.en.trim(), p.slug).not.toBe("");
        expect(field.tr.trim(), p.slug).not.toBe("");
        expect(field.tr, p.slug).not.toBe(field.en);
      }
      expect(p.categoryIds).toContain(p.categoryId);
    }
  });

  it("uses real Turkish characters in Turkish copy", () => {
    const tr = seed.products.map((p) => p.description.tr).join(" ") + seed.pages.map((p) => p.body.tr).join(" ");
    for (const ch of ["ç", "ğ", "ı", "ö", "ş", "ü"]) expect(tr).toContain(ch);
  });

  it("is internally consistent: unique keys and valid references", () => {
    expect(unique(seed.products.map((p) => p.slug))).toBe(true);
    expect(unique(seed.products.map((p) => p.partNumber))).toBe(true);
    expect(unique(seed.variants.map((v) => v.sku))).toBe(true);
    expect(unique(seed.variants.map((v) => v.barcode!))).toBe(true);
    expect(unique(seed.orders.map((o) => o.number))).toBe(true);
    expect(unique(seed.users.map((u) => u.email))).toBe(true);
    expect(unique(seed.coupons.map((c) => c.code))).toBe(true);
    expect(unique(seed.categories.map((c) => c.slug))).toBe(true);
    expect(unique(seed.brands.map((b) => b.slug))).toBe(true);

    const productIds = ids(seed.products);
    const variantIds = ids(seed.variants);
    const brandIds = ids(seed.brands);
    const categoryIds = ids(seed.categories);
    const vehicleIds = ids(seed.vehicles);
    const userIds = ids(seed.users);
    const modelIds = ids(seed.vehicleModels);
    const makeIds = ids(seed.vehicleMakes);

    for (const p of seed.products) {
      expect(brandIds.has(p.brandId), p.slug).toBe(true);
      for (const c of p.categoryIds) expect(categoryIds.has(c), p.slug).toBe(true);
    }
    for (const c of seed.categories) if (c.parentId) expect(categoryIds.has(c.parentId)).toBe(true);
    for (const v of seed.variants) {
      expect(productIds.has(v.productId)).toBe(true);
      const product = seed.products.find((p) => p.id === v.productId)!;
      if (v.imageId) expect(product.images.some((i) => i.id === v.imageId)).toBe(true);
      if (v.compareAtPrice) expect(v.compareAtPrice).toBeGreaterThan(v.price);
    }
    for (const m of seed.vehicleModels) expect(makeIds.has(m.makeId)).toBe(true);
    for (const v of seed.vehicles) {
      expect(makeIds.has(v.makeId)).toBe(true);
      expect(modelIds.has(v.modelId)).toBe(true);
    }
    for (const f of seed.fitment) {
      expect(productIds.has(f.productId)).toBe(true);
      expect(vehicleIds.has(f.vehicleId)).toBe(true);
    }
    for (const p of seed.products) {
      const rows = seed.fitment.filter((f) => f.productId === p.id);
      if (p.fitment === "specific") expect(rows.length, p.slug).toBeGreaterThan(0);
      else expect(rows.length, p.slug).toBe(0);
    }
    for (const r of seed.reviews) {
      expect(productIds.has(r.productId)).toBe(true);
      if (r.userId) expect(userIds.has(r.userId)).toBe(true);
    }
    for (const o of seed.orders) {
      if (o.userId) expect(userIds.has(o.userId)).toBe(true);
      for (const it of o.items) {
        expect(productIds.has(it.productId)).toBe(true);
        expect(variantIds.has(it.variantId)).toBe(true);
      }
    }
    for (const a of seed.addresses) expect(userIds.has(a.userId)).toBe(true);
    for (const w of seed.wishlists) for (const pid of w.productIds) expect(productIds.has(pid)).toBe(true);
    for (const l of seed.couponRedemptions) expect(seed.coupons.some((c) => c.id === l.couponId)).toBe(true);
    for (const a of seed.authAccounts) expect(userIds.has(a.userId)).toBe(true);
  });

  it("keeps every vehicle model's years and engines coherent (selector cascade has data)", () => {
    for (const make of seed.vehicleMakes) {
      const models = seed.vehicleModels.filter((m) => m.makeId === make.id);
      expect(models.length, make.name).toBeGreaterThan(0);
      for (const model of models) expect(seed.vehicles.some((v) => v.modelId === model.id), model.name).toBe(true);
    }
  });
});

describe("seed commerce maths", () => {
  it("orders add up (subtotal, discount, shipping, tax, total, charge)", () => {
    for (const o of seed.orders) {
      const gross = o.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      expect(gross, o.number).toBe(o.subtotal);
      expect(o.items.reduce((s, i) => s + i.discount, 0), o.number).toBe(o.discount);
      expect(o.items.reduce((s, i) => s + i.tax, 0), o.number).toBe(o.tax);
      expect(o.items.reduce((s, i) => s + i.lineTotal, 0), o.number).toBe(o.subtotal - o.discount);
      expect(o.total, o.number).toBe(o.subtotal - o.discount + o.shipping + o.tax);
      expect(o.chargedTotal, o.number).toBe(Math.round(o.total * o.fxRate));
      expect(o.refundedTotal, o.number).toBeLessThanOrEqual(o.total);
      expect(o.currency).toBe(o.locale === "tr" ? "TRY" : "USD");
    }
  });

  it("every order has a payment whose amount matches and whose refunds sum up", () => {
    for (const o of seed.orders) {
      const p = seed.payments.find((x) => x.id === o.paymentId)!;
      expect(p, o.number).toBeDefined();
      expect(p.orderId).toBe(o.id);
      expect(p.amount).toBe(o.chargedTotal);
      expect(p.refunds.reduce((s, r) => s + r.amount, 0), o.number).toBe(o.refundedTotal);
      if (o.paymentStatus === "paid" || o.paymentStatus === "partially_refunded" || o.paymentStatus === "refunded") expect(p.status).toBe("succeeded");
    }
  });

  it("order events are chronological and end consistently with the status", () => {
    for (const o of seed.orders) {
      const times = o.events.map((e) => Date.parse(e.at));
      expect([...times].sort((a, b) => a - b), o.number).toEqual(times);
      if (o.status === "shipped" || o.status === "delivered") expect(o.shippedAt, o.number).toBeDefined();
      if (o.status === "delivered") expect(o.deliveredAt, o.number).toBeDefined();
    }
  });

  it("stock fields reconcile with the inventory ledger", () => {
    const last = new Map<string, (typeof seed.inventoryMovements)[number]>();
    for (const m of seed.inventoryMovements) last.set(m.variantId, m);
    for (const v of seed.variants) {
      expect(v.stockOnHand, v.sku).toBeGreaterThanOrEqual(0);
      expect(v.stockReserved, v.sku).toBeGreaterThanOrEqual(0);
      expect(v.stockReserved, v.sku).toBeLessThanOrEqual(v.stockOnHand);
      const m = last.get(v.id)!;
      expect(m, v.sku).toBeDefined();
      expect(m.onHandAfter, v.sku).toBe(v.stockOnHand);
      expect(m.reservedAfter, v.sku).toBe(v.stockReserved);
    }
    // replaying deltas reproduces each variant's stock
    const replay = new Map<string, { on: number; res: number }>();
    for (const m of seed.inventoryMovements) {
      const s = replay.get(m.variantId) ?? { on: 0, res: 0 };
      s.on += m.delta;
      s.res += m.reservedDelta;
      replay.set(m.variantId, s);
      expect(m.onHandAfter).toBe(s.on);
      expect(m.reservedAfter).toBe(s.res);
    }
  });

  it("denormalised product aggregates match approved reviews", () => {
    for (const p of seed.products) {
      const approved = seed.reviews.filter((r) => r.productId === p.id && r.status === "approved");
      expect(p.ratingCount, p.slug).toBe(approved.length);
      const avg = approved.length ? Math.round((approved.reduce((s, r) => s + r.rating, 0) / approved.length) * 10) / 10 : 0;
      expect(p.ratingAverage, p.slug).toBe(avg);
    }
  });

  it("coupon usage is at least the number of recorded redemptions", () => {
    for (const c of seed.coupons) {
      const n = seed.couponRedemptions.filter((r) => r.couponId === c.id).length;
      expect(c.usedCount, c.code).toBeGreaterThanOrEqual(n);
    }
  });

  it("settings point at the next unused order number", () => {
    const settings = seed.settings[0]!;
    const max = Math.max(...seed.orders.map((o) => Number(o.number.replace(settings.checkout.orderNumberPrefix, ""))));
    expect(settings.checkout.nextOrderNumber).toBe(max + 1);
  });
});

describe("seed imagery", () => {
  it("has a generated SVG for every image the seed references (run npm run art:products)", () => {
    const urls = [
      ...seed.products.flatMap((p) => p.images.map((i) => i.url)),
      ...seed.categories.map((c) => c.image).filter((u): u is string => Boolean(u)),
      ...seed.brands.map((b) => b.logo).filter((u): u is string => Boolean(u)),
      ...seed.banners.map((b) => b.image).filter((u): u is string => Boolean(u)),
      ...seed.orders.flatMap((o) => o.items.map((i) => i.image).filter((u): u is string => Boolean(u))),
    ];
    const missing = [...new Set(urls)].filter((u) => !existsSync(path.join(process.cwd(), "public", u)));
    expect(missing).toEqual([]);
  });
});

describe("seed accounts", () => {
  it("creates admin, staff and customer with Better Auth compatible credential accounts", async () => {
    for (const cred of Object.values(SEED_CREDENTIALS)) {
      const user = seed.users.find((u) => u.email === cred.email)!;
      expect(user.role).toBe(cred.role);
      expect(user.emailVerified).toBe(true);
      const account = seed.authAccounts.find((a) => a.userId === user.id)!;
      expect(account.providerId).toBe("credential");
      expect(account.accountId).toBe(user.id);
      expect(await verifyPassword({ hash: account.password!, password: cred.password })).toBe(true);
      expect(await verifyPassword({ hash: account.password!, password: cred.password + "x" })).toBe(false);
    }
    expect(seed.users.filter((u) => u.role === "customer").length).toBeGreaterThan(5);
    expect(seed.users.some((u) => u.disabled)).toBe(true);
  });
});

describe("catalog generation", () => {
  it("is deterministic apart from dates (same ids, slugs, SKUs and prices)", () => {
    const vehicles = buildVehicles();
    const a = buildCatalog(makeClock(new Date("2026-03-01T10:00:00Z")), vehicles);
    const b = buildCatalog(makeClock(new Date("2026-09-09T10:00:00Z")), vehicles);
    const strip = (c: typeof a) => c.variants.map((v) => [v.id, v.sku, v.price, v.compareAtPrice, v.stockOnHand]);
    expect(strip(a)).toEqual(strip(b));
    expect(a.products.map((p) => p.slug)).toEqual(b.products.map((p) => p.slug));
    expect(a.fitment.map((f) => f.id)).toEqual(b.fitment.map((f) => f.id));
  });

  it("references only art files that the generator produces", () => {
    const catalog = buildCatalog(makeClock(), buildVehicles());
    const files = new Set(catalog.artJobs.map((j) => `/products/${j.file}`));
    for (const p of catalog.products) for (const img of p.images) expect(files.has(img.url), img.url).toBe(true);
  });
});

describe("seeding a real store", () => {
  const dirs: string[] = [];
  afterAll(async () => {
    for (const d of dirs) await fs.rm(d, { recursive: true, force: true });
  });

  it("boots from the seed, serves it, survives a reload and does not re-seed", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "apexline-seed-"));
    dirs.push(dir);
    const db = createJsonDatabase({ dir, seed: () => seed });
    expect(await db.repo("products").count()).toBe(seed.products.length);
    expect(await db.repo("fitment").count()).toBe(seed.fitment.length);
    const admin = await db.repo("users").findOne((u) => u.email === SEED_CREDENTIALS.admin.email);
    expect(admin?.role).toBe("admin");

    // transactional stock change persists
    const variant = seed.variants.find((v) => v.stockOnHand > 5)!;
    await db.transaction(async (tx) => {
      const v = (await tx.repo("variants").get(variant.id))!;
      await tx.repo("variants").update(variant.id, { stockOnHand: v.stockOnHand - 3 });
    });

    let reseeded = false;
    const again = createJsonDatabase({
      dir,
      seed: () => {
        reseeded = true;
        return {};
      },
    });
    expect((await again.repo("variants").get(variant.id))?.stockOnHand).toBe(variant.stockOnHand - 3);
    expect(reseeded).toBe(false);
  });
});

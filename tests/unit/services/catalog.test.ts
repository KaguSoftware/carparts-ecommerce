import { CARD_OK, freshSeed, STAFF } from "../helpers/test-env";
import { beforeAll, describe, expect, it } from "vitest";
import * as catalog from "@/lib/services/catalog";
import * as vehicles from "@/lib/services/vehicles";
import { db } from "@/lib/db";

beforeAll(async () => {
  await freshSeed();
}, 60_000);

void CARD_OK;

describe("catalog.listProducts", () => {
  it("lists only active products with an active variant, paginated", async () => {
    const first = await catalog.listProducts({ pageSize: 10 });
    expect(first.items).toHaveLength(10);
    expect(first.total).toBeGreaterThan(100);
    expect(first.pageCount).toBe(Math.ceil(first.total / 10));
    const drafts = await db.products.find({ where: (p) => p.status !== "active" });
    expect(drafts.length).toBeGreaterThan(0);
    const all = await catalog.listProducts({ pageSize: 100 });
    const ids = new Set(all.items.map((i) => i.id));
    for (const d of drafts) expect(ids.has(d.id)).toBe(false);

    const second = await catalog.listProducts({ pageSize: 10, page: 2 });
    expect(second.items[0]?.id).not.toBe(first.items[0]?.id);
    const clamped = await catalog.listProducts({ pageSize: 9999 });
    expect(clamped.pageSize).toBe(100);
  });

  it("filters by category subtree, brand, price, stock and sale", async () => {
    const brakes = await catalog.getCategoryBySlug("brakes");
    expect(brakes).toBeTruthy();
    const inBrakes = await catalog.listProducts({ categorySlug: "brakes", pageSize: 100 });
    expect(inBrakes.total).toBeGreaterThan(5);
    for (const item of inBrakes.items) {
      const p = await catalog.getProductById(item.id);
      expect(p?.categoryIds.length).toBeGreaterThan(0);
    }

    const brand = inBrakes.facets.brands[0];
    expect(brand).toBeTruthy();
    const byBrand = await catalog.listProducts({ categorySlug: "brakes", brandSlugs: [brand!.slug], pageSize: 100 });
    expect(byBrand.total).toBe(brand!.count);
    expect(byBrand.items.every((i) => i.brand.slug === brand!.slug)).toBe(true);

    const priced = await catalog.listProducts({ minPrice: 2000, maxPrice: 5000, pageSize: 100 });
    expect(priced.total).toBeGreaterThan(0);
    for (const i of priced.items) {
      const detail = await catalog.getProductBySlug(i.slug);
      expect(detail!.variants.some((v) => v.price >= 2000 && v.price <= 5000)).toBe(true);
    }

    const sale = await catalog.listProducts({ onSale: true, pageSize: 100 });
    expect(sale.total).toBeGreaterThan(0);
    expect(sale.items.every((i) => i.compareAtFrom === undefined || i.compareAtFrom > i.priceFrom)).toBe(true);

    const inStock = await catalog.listProducts({ inStockOnly: true, pageSize: 100 });
    expect(inStock.items.every((i) => i.stockStatus !== "out_of_stock")).toBe(true);
    expect(inStock.total).toBeLessThanOrEqual((await catalog.listProducts({ pageSize: 1 })).total);

    const unknownCategory = await catalog.listProducts({ categorySlug: "does-not-exist" });
    expect(unknownCategory.total).toBe(0);
  });

  it("sorts by price, name and rating", async () => {
    const asc = await catalog.listProducts({ sort: "price_asc", pageSize: 100 });
    const prices = asc.items.map((i) => i.priceFrom);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    const desc = await catalog.listProducts({ sort: "price_desc", pageSize: 100 });
    const dPrices = desc.items.map((i) => i.priceFrom);
    expect(dPrices).toEqual([...dPrices].sort((a, b) => b - a));
    const rated = await catalog.listProducts({ sort: "rating", pageSize: 20 });
    const ratings = rated.items.map((i) => i.ratingAverage);
    expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
    const newest = await catalog.listProducts({ sort: "newest", pageSize: 20 });
    const dates = newest.items.map((i) => i.createdAt);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("computes facets that ignore their own filter", async () => {
    const all = await catalog.listProducts({ pageSize: 1 });
    expect(all.facets.priceRange.min).toBeGreaterThan(0);
    expect(all.facets.priceRange.max).toBeGreaterThan(all.facets.priceRange.min);
    const brand = all.facets.brands[0]!;
    const filtered = await catalog.listProducts({ brandSlugs: [brand.slug], pageSize: 1 });
    // choosing a brand must not collapse the brand facet to a single entry
    expect(filtered.facets.brands.length).toBe(all.facets.brands.length);
    expect(all.facets.ratings).toHaveLength(5);
  });

  it("returns product detail without cost prices, with variants, related items and breadcrumb", async () => {
    const list = await catalog.listProducts({ pageSize: 1 });
    const slug = list.items[0]!.slug;
    const detail = await catalog.getProductBySlug(slug);
    expect(detail).toBeTruthy();
    expect(detail!.variants.length).toBeGreaterThan(0);
    for (const v of detail!.variants) {
      expect(v).not.toHaveProperty("cost");
      expect(v.available).toBeGreaterThanOrEqual(0);
    }
    expect(detail!.categoryPath.at(-1)?.id).toBe(detail!.category.id);
    expect(detail!.related.every((r) => r.id !== detail!.product.id)).toBe(true);
    expect(detail!.variants.some((v) => v.id === detail!.defaultVariantId)).toBe(true);
    expect(await catalog.getProductBySlug("no-such-product")).toBeNull();
    const draft = (await db.products.find({ where: (p) => p.status === "draft" }))[0]!;
    expect(await catalog.getProductBySlug(draft.slug)).toBeNull();
  });

  it("keeps summaries in input order and skips unknown ids", async () => {
    const list = await catalog.listProducts({ pageSize: 5 });
    const ids = list.items.map((i) => i.id).reverse();
    const result = await catalog.getProductSummaries([...ids, "prd_missing"]);
    expect(result.map((r) => r.id)).toEqual(ids);
  });

  it("builds a category tree with product counts and hides inactive branches", async () => {
    const tree = await catalog.getCategoryTree();
    expect(tree.map((n) => n.slug)).toContain("brakes");
    const brakes = tree.find((n) => n.slug === "brakes")!;
    expect(brakes.children.length).toBeGreaterThan(0);
    expect(brakes.productCount).toBeGreaterThanOrEqual(brakes.children.reduce((s, c) => s + c.productCount, 0) > 0 ? 1 : 0);

    await catalog.updateCategory(brakes.id, { isActive: false }, STAFF);
    const hidden = await catalog.getCategoryTree();
    expect(hidden.find((n) => n.slug === "brakes")).toBeUndefined();
    expect(await catalog.getCategoryBySlug("brakes")).toBeNull();
    const withInactive = await catalog.getCategoryTree({ includeInactive: true });
    expect(withInactive.find((n) => n.slug === "brakes")).toBeTruthy();
    await catalog.updateCategory(brakes.id, { isActive: true }, STAFF);
  });

  it("filters by vehicle: specific parts only for fitting vehicles, universal always", async () => {
    const make = (await vehicles.listMakes())[0]!;
    const model = (await vehicles.listModels(make.id))[0]!;
    const year = (await vehicles.listYears(model.id))[0]!;
    const engine = (await vehicles.listEngines(model.id, year))[0]!;
    const filtered = await catalog.listProducts({ vehicle: { vehicleId: engine.id }, pageSize: 100 });
    const total = (await catalog.listProducts({ pageSize: 1 })).total;
    expect(filtered.total).toBeLessThanOrEqual(total);
    for (const item of filtered.items) {
      expect(item.fitsSelectedVehicle).toBe(true);
      const fit = await vehicles.checkFitment(item.id, { vehicleId: engine.id });
      expect(["fits", "universal"]).toContain(fit.status);
    }
  });
});

describe("catalog admin", () => {
  it("creates, updates, archives and deletes a product with variants", async () => {
    const brand = (await catalog.listBrands())[0]!;
    const category = (await catalog.getCategoryTree())[0]!.children[0]!;
    const product = await catalog.createProduct(
      {
        name: { en: "Test Widget Pro", tr: "Test Widget Pro TR" },
        summary: { en: "A widget for testing", tr: "Test için parça" },
        description: { en: "Long text", tr: "" },
        brandId: brand.id,
        categoryId: category.id,
        specs: [],
        tags: ["widget"],
        status: "active",
        isFeatured: false,
        partNumber: "TW-0001",
        oemNumbers: [],
        warrantyMonths: 12,
        fitment: "universal",
      },
      STAFF,
    );
    expect(product.slug).toBe("test-widget-pro");
    expect(product.categoryIds[0]).toBe(category.id);

    // a second product with the same name gets a unique slug
    const twin = await catalog.createProduct({ ...product, slug: undefined, name: { en: "Test Widget Pro", tr: "" }, specs: [], tags: [], partNumber: "TW-0002", oemNumbers: [] }, STAFF);
    expect(twin.slug).toBe("test-widget-pro-2");
    await expect(catalog.createProduct({ ...product, slug: "test-widget-pro", specs: [], tags: [], oemNumbers: [], partNumber: "X1" }, STAFF)).rejects.toMatchObject({ code: "slug_taken" });

    const variant = await catalog.createVariant(
      product.id,
      { sku: "TW-0001-A", name: { en: "Standard", tr: "Standart" }, options: [], price: 1999, compareAtPrice: 2499, cost: 900, initialStock: 7, lowStockThreshold: 2, weightGrams: 500, isActive: true, isDefault: false },
      STAFF,
    );
    expect(variant.isDefault).toBe(true); // first variant becomes the default
    expect(variant.stockOnHand).toBe(7);
    await expect(catalog.createVariant(product.id, { sku: "tw-0001-a", name: { en: "Dup", tr: "" }, options: [], price: 100, lowStockThreshold: 1, weightGrams: 1, isActive: true, isDefault: false }, STAFF)).rejects.toMatchObject({ code: "sku_taken" });
    await expect(catalog.updateVariant(variant.id, { price: 1000, compareAtPrice: 900 }, STAFF)).rejects.toMatchObject({ code: "validation_failed" });

    const second = await catalog.createVariant(product.id, { sku: "TW-0001-B", name: { en: "Large", tr: "Büyük" }, options: [], price: 2999, lowStockThreshold: 2, weightGrams: 800, isActive: true, isDefault: true }, STAFF);
    const refreshed = await catalog.adminGetProduct(product.id);
    expect(refreshed!.variants.filter((v) => v.isDefault).map((v) => v.id)).toEqual([second.id]);

    const updated = await catalog.updateProduct(product.id, { isFeatured: true, name: { en: "Test Widget Pro II", tr: "" } }, STAFF);
    expect(updated.isFeatured).toBe(true);
    expect(updated.slug).toBe("test-widget-pro"); // slug stable unless explicitly changed

    const row = (await catalog.adminListProducts({ q: "TW-0001-B" })).items[0];
    expect(row?.product.id).toBe(product.id);

    const audits = await db.auditLog.find({ where: (a) => a.entityId === product.id });
    expect(audits.map((a) => a.action)).toEqual(expect.arrayContaining(["product.create", "product.update"]));

    expect(await catalog.deleteProduct(product.id, STAFF)).toEqual({ deleted: true, archived: false });
    expect(await db.variants.count((v) => v.productId === product.id)).toBe(0);
    await catalog.deleteProduct(twin.id, STAFF);
  });

  it("archives instead of deleting products that were ordered, and guards category/brand deletion", async () => {
    const ordered = (await db.orders.all())[0]!.items[0]!;
    const result = await catalog.deleteProduct(ordered.productId, STAFF);
    expect(result).toEqual({ deleted: false, archived: true });
    expect((await catalog.getProductById(ordered.productId))?.status).toBe("archived");

    const tree = await catalog.getCategoryTree();
    await expect(catalog.deleteCategory(tree[0]!.id, STAFF)).rejects.toMatchObject({ code: "in_use" });
    const brand = (await catalog.listBrands())[0]!;
    await expect(catalog.deleteBrand(brand.id, STAFF)).rejects.toMatchObject({ code: "in_use" });

    const cat = await catalog.createCategory({ parentId: null, name: { en: "Temp Cat", tr: "Geçici" }, description: { en: "", tr: "" }, sortOrder: 99, isActive: true }, STAFF);
    await expect(catalog.updateCategory(cat.id, { parentId: cat.id }, STAFF)).rejects.toMatchObject({ code: "validation_failed" });
    await catalog.deleteCategory(cat.id, STAFF);
  });

  it("round-trips products through CSV and reports row errors", async () => {
    const csv = await catalog.exportProductsCsv();
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toContain("sku");
    expect(lines.length).toBeGreaterThan(100);

    const dry = await catalog.importProductsCsv(csv, STAFF, { dryRun: true });
    expect(dry.errors).toEqual([]);
    expect(dry.created).toBe(0);
    expect(dry.updated).toBeGreaterThan(100);

    // bad rows are reported, good rows applied
    const bad =
      "slug,status,name_en,name_tr,summary_en,summary_tr,brand,category,part_number,sku,price,stock\r\n" +
      "csv-new-part,active,CSV Part,CSV Parça,Summary,Özet,apexline-select,brake-pads,CSV-1,CSV-SKU-1,12.50,9\r\n" +
      "csv-bad-part,active,Bad Part,,Summary,,no-such-brand,brake-pads,CSV-2,CSV-SKU-2,12.50,9\r\n" +
      "csv-new-part,active,,,,,,,,CSV-SKU-3,not-a-price,1\r\n";
    const report = await catalog.importProductsCsv(bad, STAFF);
    expect(report.created).toBe(1);
    expect(report.errors.map((e) => e.row).sort()).toEqual([3, 4]);
    expect(await db.variants.findOne((v) => v.sku === "CSV-SKU-1")).toBeTruthy();
    expect(await db.variants.findOne((v) => v.sku === "CSV-SKU-2")).toBeNull();

    await expect(catalog.importProductsCsv("just,one,line", STAFF)).rejects.toMatchObject({ code: "csv_invalid" });
  });
});

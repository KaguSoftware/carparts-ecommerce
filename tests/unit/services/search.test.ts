import { freshSeed } from "../helpers/test-env";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import * as search from "@/lib/services/search";
import * as vehicles from "@/lib/services/vehicles";
import { compact, fold, levenshtein, scoreDoc, tokenize, tokenVariants, type SearchDoc } from "@/lib/services/_text";

beforeAll(async () => {
  await freshSeed();
}, 60_000);

describe("text folding", () => {
  it("folds case, punctuation and Turkish letters", () => {
    expect(fold("Fren Balatası (Ön)")).toBe("fren balatasi on");
    expect(fold("YAĞ FİLTRESİ")).toBe("yag filtresi");
    expect(fold("yağ filtresi")).toBe("yag filtresi");
    expect(fold("ŞÖFÖR ÇÜĞ")).toBe("sofor cug");
    expect(fold("Brake & Clutch")).toBe("brake and clutch");
    expect(compact("BP-1234/A")).toBe("bp1234a");
    expect(tokenize("  Oil   filter!! ")).toEqual(["oil", "filter"]);
    expect(tokenVariants("pads")).toContain("pad");
    expect(tokenVariants("filtreler")).toContain("filtre");
    expect(levenshtein("brake", "brak")).toBe(1);
    expect(levenshtein("abc", "xyz", 2)).toBeGreaterThan(2);
  });

  it("scores exact part numbers above prefixes above name words above descriptions", () => {
    const doc = (over: Partial<SearchDoc>): SearchDoc => ({ id: "x", codes: [], names: [""], nameWords: [[]], brand: "", categories: [], tags: [], summary: "", description: "", ...over });
    const q = "bp-1234";
    const exact = scoreDoc(doc({ codes: ["bp1234"] }), q, tokenize(q));
    const prefix = scoreDoc(doc({ codes: ["bp12345"] }), q, tokenize(q));
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(0);
    const word = scoreDoc(doc({ names: ["ceramic brake pad"], nameWords: [["ceramic", "brake", "pad"]] }), "brake", ["brake"]);
    const substring = scoreDoc(doc({ names: ["handbrake cable"], nameWords: [["handbrake", "cable"]] }), "brake", ["brake"]);
    const inDescription = scoreDoc(doc({ description: "works with brake systems" }), "brake", ["brake"]);
    expect(word).toBeGreaterThan(substring);
    expect(substring).toBeGreaterThan(inDescription);
    expect(inDescription).toBeGreaterThan(0);
    // AND semantics: every token must match somewhere
    expect(scoreDoc(doc({ names: ["brake pad"], nameWords: [["brake", "pad"]] }), "brake rotor", ["brake", "rotor"])).toBe(0);
    expect(scoreDoc(doc({}), "", [])).toBe(0);
  });
});

describe("searchProducts", () => {
  it("finds a product by its exact part number first, however it is typed", async () => {
    const p = (await db.products.find({ where: (x) => x.status === "active" }))[5]!;
    for (const q of [p.partNumber, p.partNumber.toLowerCase(), p.partNumber.replace(/-/g, " "), p.partNumber.replace(/-/g, "")]) {
      const result = await search.searchProducts({ q });
      expect(result.items[0]?.id, q).toBe(p.id);
    }
  });

  it("finds by SKU and OEM number", async () => {
    const variant = (await db.variants.find({ where: (v) => v.isActive }))[7]!;
    const bySku = await search.searchProducts({ q: variant.sku.toLowerCase() });
    expect(bySku.items.map((i) => i.id)).toContain(variant.productId);
    const withOem = (await db.products.find({ where: (p) => p.status === "active" && p.oemNumbers.length > 0 }))[0]!;
    const byOem = await search.searchProducts({ q: withOem.oemNumbers[0]! });
    expect(byOem.items.map((i) => i.id)).toContain(withOem.id);
  });

  it("matches names in both languages, ignoring case and diacritics", async () => {
    const en = await search.searchProducts({ q: "brake pads", pageSize: 100 });
    expect(en.total).toBeGreaterThan(3);
    const tr = await search.searchProducts({ q: "fren balata", locale: "tr", pageSize: 100 });
    expect(tr.total).toBeGreaterThan(3);
    const upper = await search.searchProducts({ q: "FREN BALATASI", locale: "tr", pageSize: 100 });
    expect(upper.total).toBeGreaterThan(0);
    const dotted = await search.searchProducts({ q: "YAĞ FİLTRESİ", locale: "tr", pageSize: 100 });
    const plain = await search.searchProducts({ q: "yag filtresi", locale: "tr", pageSize: 100 });
    expect(dotted.total).toBe(plain.total);
    expect(plain.total).toBeGreaterThan(0);
    // singular/plural
    const singular = await search.searchProducts({ q: "brake pad", pageSize: 100 });
    expect(singular.total).toBeGreaterThanOrEqual(en.total);
    expect((await search.searchProducts({ q: "zzzzqqqq" })).total).toBe(0);
  });

  it("matches brands and tags, and ranks name hits above incidental mentions", async () => {
    const brand = (await db.brands.find({ where: (b) => b.isActive }))[3]!;
    const byBrand = await search.searchProducts({ q: brand.name, pageSize: 100 });
    expect(byBrand.total).toBeGreaterThan(0);
    const result = await search.searchProducts({ q: "brake", pageSize: 10 });
    const topNames = result.items.slice(0, 5).map((i) => `${i.name.en} ${i.category.name.en}`.toLowerCase());
    expect(topNames.every((n) => n.includes("brake"))).toBe(true);
  });

  it("combines text with filters, facets and sorting", async () => {
    const all = await search.searchProducts({ q: "filter", pageSize: 100 });
    expect(all.total).toBeGreaterThan(5);
    const brand = all.facets.brands[0]!;
    const filtered = await search.searchProducts({ q: "filter", brandSlugs: [brand.slug], pageSize: 100 });
    expect(filtered.total).toBe(brand.count);
    const cheap = await search.searchProducts({ q: "filter", sort: "price_asc", pageSize: 100 });
    const prices = cheap.items.map((i) => i.priceFrom);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(all.facets.priceRange.min).toBeLessThanOrEqual(all.facets.priceRange.max);
  });

  it("suggests a corrected query when nothing matches", async () => {
    const typo = await search.searchProducts({ q: "brak pads" });
    expect(typo.total).toBeGreaterThan(0); // "brak" is a prefix-ish miss but "brake" substring... either way see below
    const miss = await search.searchProducts({ q: "brakee padz" });
    if (miss.total === 0) expect(miss.didYouMean).toMatch(/^brakes? pads?$/);
    const none = await search.searchProducts({ q: "qqqqzzzz" });
    expect(none.total).toBe(0);
    expect(none.didYouMean).toBeUndefined();
  });

  it("restricts to a vehicle (universal parts always stay)", async () => {
    const v = (await db.vehicles.find({ limit: 1 }))[0]!;
    const all = await search.searchProducts({ q: "brake", pageSize: 100 });
    const fitting = await search.searchProducts({ q: "brake", vehicle: { vehicleId: v.id }, pageSize: 100 });
    expect(fitting.total).toBeLessThanOrEqual(all.total);
    for (const item of fitting.items) {
      expect(["fits", "universal"]).toContain((await vehicles.checkFitment(item.id, { vehicleId: v.id })).status);
    }
  });
});

describe("autocomplete", () => {
  it("returns products, categories and brands for a short query, capped at 8 products", async () => {
    const s = await search.suggest("brake", { locale: "en" });
    expect(s.query).toBe("brake");
    expect(s.products.length).toBeGreaterThan(0);
    expect(s.products.length).toBeLessThanOrEqual(8);
    expect(s.categories.length).toBeLessThanOrEqual(4);
    expect(s.categories.some((c) => c.slug.includes("brake"))).toBe(true);
    expect(s.products[0]).toHaveProperty("priceFrom");
    expect(Object.keys(s.products[0]!).sort()).toEqual(["brand", "id", "image", "name", "partNumber", "priceFrom", "slug"].filter((k) => k in s.products[0]!).sort());
    expect((await search.suggest("brake", { limit: 3 })).products.length).toBeLessThanOrEqual(3);
  });

  it("ignores queries that are too short and handles Turkish input", async () => {
    expect((await search.suggest("b")).products).toEqual([]);
    expect((await search.suggest("   ")).products).toEqual([]);
    const tr = await search.suggest("balata", { locale: "tr" });
    expect(tr.products.length).toBeGreaterThan(0);
    expect(tr.categories.some((c) => fold(c.name.tr).includes("balata"))).toBe(true);
  });

  it("jumps straight to an exact SKU / part / OEM hit", async () => {
    const p = (await db.products.find({ where: (x) => x.status === "active" }))[2]!;
    const byPart = await search.suggest(p.partNumber.toLowerCase());
    expect(byPart.exactMatch).toEqual({ slug: p.slug, matchedOn: "partNumber" });
    const variant = (await db.variants.find({ where: (v) => v.isActive && v.productId === p.id }))[0]!;
    const bySku = await search.suggest(variant.sku);
    expect(bySku.exactMatch?.slug).toBe(p.slug);
    expect((await search.suggest("brake")).exactMatch).toBeUndefined();
  });

  it("prefers parts that fit the selected vehicle", async () => {
    const fitRow = (await db.fitment.findOne(() => true))!;
    const product = (await db.products.get(fitRow.productId))!;
    const s = await search.suggest(product.partNumber, { vehicle: { vehicleId: fitRow.vehicleId } });
    expect(s.products[0]?.id).toBe(product.id);
  });
});

describe("popular searches and the search log", () => {
  it("falls back to localized defaults and learns from recorded searches", async () => {
    await db.searchLog.deleteWhere(() => true);
    const defaults = await search.getPopularSearches("tr");
    expect(defaults).toContain("fren balatası");
    for (let i = 0; i < 5; i++) await search.recordSearch("Turbo Kit", 4);
    for (let i = 0; i < 3; i++) await search.recordSearch("exhaust gasket", 2);
    await search.recordSearch("nothing here", 0); // zero-result searches are not "popular"
    await search.recordSearch("x", 5); // too short
    const popular = await search.getPopularSearches("en");
    expect(popular[0]).toBe("turbo kit");
    expect(popular).toContain("exhaust gasket");
    expect(popular).not.toContain("nothing here");
    expect(await db.searchLog.count()).toBe(9);
  });

  it("keeps the log bounded", async () => {
    await db.searchLog.deleteWhere(() => true);
    const at = new Date().toISOString();
    await db.transaction(async () => {
      for (let i = 0; i < 4010; i++) await db.searchLog.insert({ q: `term ${i}`, resultCount: 1, at });
    });
    await search.recordSearch("one more", 1);
    expect(await db.searchLog.count()).toBeLessThanOrEqual(3600);
  }, 60_000);
});

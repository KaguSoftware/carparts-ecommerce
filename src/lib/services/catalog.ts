import "server-only";
import { db } from "@/lib/db";
import { localize } from "@/lib/i18n-string";
import type {
  Brand,
  Category,
  CategoryNode,
  Id,
  Product,
  ProductDetail,
  ProductSummary,
  ProductVariant,
  VehicleSelection,
} from "@/lib/types/domain";
import { LOCALES, type Locale } from "@/i18n/routing";
import type { ProductFacets, ProductListResult, ProductQuery } from "./contracts";
import {
  activeVariants,
  buildCategoryTree,
  buildSearchDoc,
  categorySubtree,
  isListable,
  loadCatalogContext,
  productIdsFitting,
  stripCost,
  toSummary,
  toVariantView,
  type CatalogContext,
} from "./_catalog-data";
import { normalizePage } from "./_shared";
import { scoreDoc, tokenize } from "./_text";
import { availableOf } from "./inventory";

/* Admin writes and CSV live in sibling modules and are re-exported so `catalog` stays one module (see contracts.ts). */
export {
  adminGetProduct,
  adminListProducts,
  createBrand,
  createCategory,
  createProduct,
  createVariant,
  deleteBrand,
  deleteCategory,
  deleteProduct,
  deleteVariant,
  setProductImages,
  setProductStatus,
  updateBrand,
  updateCategory,
  updateProduct,
  updateVariant,
} from "./_catalog-admin";
export { exportProductsCsv, importProductsCsv } from "./_catalog-csv";

/* ------------------------------------------------------------------ filtering */

interface ResolvedQuery {
  categorySet?: Set<Id>;
  brandSet?: Set<Id>;
  fits: Set<Id> | null;
  scores?: Map<Id, number>;
}

type FilterKey = "brand" | "category" | "price" | "stock" | "sale" | "rating";

async function resolveQuery(ctx: CatalogContext, query: ProductQuery): Promise<ResolvedQuery> {
  const resolved: ResolvedQuery = { fits: await productIdsFitting(query.vehicle) };

  let categoryId = query.categoryId;
  if (!categoryId && query.categorySlug) categoryId = [...ctx.categories.values()].find((c) => c.slug === query.categorySlug)?.id ?? "__none__";
  if (categoryId) resolved.categorySet = categoryId === "__none__" ? new Set() : categorySubtree(ctx.categories.values(), categoryId);

  if (query.brandIds?.length || query.brandSlugs?.length) {
    const wantedSlugs = new Set(query.brandSlugs ?? []);
    const wantedIds = new Set(query.brandIds ?? []);
    resolved.brandSet = new Set([...ctx.brands.values()].filter((b) => wantedIds.has(b.id) || wantedSlugs.has(b.slug)).map((b) => b.id));
  }

  const q = query.q?.trim();
  if (q) {
    const tokens = tokenize(q);
    const nameIndex = query.locale ? LOCALES.indexOf(query.locale) : undefined;
    resolved.scores = new Map();
    if (tokens.length) {
      for (const p of ctx.products) {
        const score = scoreDoc(buildSearchDoc(ctx, p), q, tokens, nameIndex);
        if (score > 0) resolved.scores.set(p.id, score);
      }
    }
  }
  return resolved;
}

function matches(ctx: CatalogContext, p: Product, query: ProductQuery, r: ResolvedQuery, skip: ReadonlySet<FilterKey> = new Set()): boolean {
  if (!isListable(ctx, p)) return false;
  if (r.scores && !r.scores.has(p.id)) return false;
  if (r.fits && p.fitment !== "universal" && !r.fits.has(p.id)) return false;
  if (query.featured && !p.isFeatured) return false;
  if (!skip.has("category") && r.categorySet && !p.categoryIds.some((c) => (r.categorySet as Set<Id>).has(c))) return false;
  if (!skip.has("brand") && r.brandSet && !r.brandSet.has(p.brandId)) return false;
  if (!skip.has("rating") && query.minRating !== undefined && p.ratingAverage < query.minRating) return false;

  const variants = activeVariants(ctx, p.id);
  if (!skip.has("price") && (query.minPrice !== undefined || query.maxPrice !== undefined)) {
    const ok = variants.some((v) => (query.minPrice === undefined || v.price >= query.minPrice) && (query.maxPrice === undefined || v.price <= query.maxPrice));
    if (!ok) return false;
  }
  if (!skip.has("stock") && query.inStockOnly && !variants.some((v) => availableOf(v) > 0)) return false;
  if (!skip.has("sale") && query.onSale && !variants.some((v) => v.compareAtPrice !== undefined && v.compareAtPrice > v.price)) return false;
  return true;
}

function buildFacets(ctx: CatalogContext, query: ProductQuery, r: ResolvedQuery): ProductFacets {
  const pool = (skip: FilterKey) => ctx.products.filter((p) => matches(ctx, p, query, r, new Set([skip])));

  const brandCounts = new Map<Id, number>();
  for (const p of pool("brand")) brandCounts.set(p.brandId, (brandCounts.get(p.brandId) ?? 0) + 1);
  const brands = [...brandCounts.entries()]
    .map(([id, count]) => ({ brand: ctx.brands.get(id) as Brand, count }))
    .filter((x) => x.brand)
    .sort((a, b) => b.count - a.count || a.brand.name.localeCompare(b.brand.name))
    .map(({ brand, count }) => ({ id: brand.id, slug: brand.slug, name: brand.name, count }));

  const categoryCounts = new Map<Id, number>();
  for (const p of pool("category")) for (const id of new Set(p.categoryIds)) categoryCounts.set(id, (categoryCounts.get(id) ?? 0) + 1);
  const categories = [...categoryCounts.entries()]
    .map(([id, count]) => ({ category: ctx.categories.get(id) as Category, count }))
    .filter((x) => x.category && x.category.isActive)
    .sort((a, b) => b.count - a.count || a.category.name.en.localeCompare(b.category.name.en))
    .map(({ category, count }) => ({ id: category.id, slug: category.slug, name: category.name, count }));

  const pricePool = pool("price");
  let min = Infinity;
  let max = 0;
  for (const p of pricePool) {
    for (const v of activeVariants(ctx, p.id)) {
      min = Math.min(min, v.price);
      max = Math.max(max, v.price);
    }
  }

  const stockPool = pool("stock");
  const salePool = pool("sale");
  const ratingPool = pool("rating");
  return {
    brands,
    categories,
    priceRange: { min: Number.isFinite(min) ? min : 0, max },
    inStockCount: stockPool.filter((p) => activeVariants(ctx, p.id).some((v) => availableOf(v) > 0)).length,
    onSaleCount: salePool.filter((p) => activeVariants(ctx, p.id).some((v) => v.compareAtPrice !== undefined && v.compareAtPrice > v.price)).length,
    ratings: ([5, 4, 3, 2, 1] as const).map((rating) => ({ rating, count: ratingPool.filter((p) => p.ratingCount > 0 && p.ratingAverage >= rating).length })),
  };
}

function sortProducts(ctx: CatalogContext, list: Product[], query: ProductQuery, r: ResolvedQuery): Product[] {
  const locale: Locale = query.locale ?? "en";
  const sort = query.sort ?? "featured";
  const price = (p: Product) => Math.min(...activeVariants(ctx, p.id).map((v) => v.price));
  const byName = (a: Product, b: Product) => localize(a.name, locale).localeCompare(localize(b.name, locale), locale);
  const relevance = (p: Product) => r.scores?.get(p.id) ?? 0;
  const out = [...list];
  if (r.scores && sort === "featured") {
    return out.sort((a, b) => relevance(b) - relevance(a) || Number(b.isFeatured) - Number(a.isFeatured) || b.soldCount - a.soldCount || byName(a, b));
  }
  switch (sort) {
    case "newest":
      return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || byName(a, b));
    case "price_asc":
      return out.sort((a, b) => price(a) - price(b) || byName(a, b));
    case "price_desc":
      return out.sort((a, b) => price(b) - price(a) || byName(a, b));
    case "rating":
      return out.sort((a, b) => b.ratingAverage - a.ratingAverage || b.ratingCount - a.ratingCount || byName(a, b));
    case "bestselling":
      return out.sort((a, b) => b.soldCount - a.soldCount || byName(a, b));
    case "name_asc":
      return out.sort(byName);
    case "featured":
    default:
      return out.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || b.soldCount - a.soldCount || byName(a, b));
  }
}

export async function listProducts(query: ProductQuery): Promise<ProductListResult> {
  const ctx = await loadCatalogContext();
  const r = await resolveQuery(ctx, query);
  const filtered = ctx.products.filter((p) => matches(ctx, p, query, r));
  const sorted = sortProducts(ctx, filtered, query, r);
  const { page, pageSize } = normalizePage(query);
  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const items = sorted.slice((page - 1) * pageSize, page * pageSize).map((p) => toSummary(ctx, p, r.fits));
  return { items, total, page, pageSize, pageCount, facets: buildFacets(ctx, query, r) };
}

/* ------------------------------------------------------------------ single product */

export async function getProductBySlug(slug: string, opts: { vehicle?: VehicleSelection } = {}): Promise<ProductDetail | null> {
  const ctx = await loadCatalogContext();
  const product = ctx.products.find((p) => p.slug === slug);
  if (!product || !isListable(ctx, product)) return null;
  const brand = ctx.brands.get(product.brandId) as Brand;
  const category = ctx.categories.get(product.categoryId) as Category;
  const variants = activeVariants(ctx, product.id).map(toVariantView);
  const defaultId = (variants.find((v) => v.isDefault) ?? [...variants].sort((a, b) => a.price - b.price)[0]) as (typeof variants)[number];

  const [fitmentCount, reviews, related] = await Promise.all([
    db.fitment.count((f) => f.productId === product.id),
    db.reviews.find({ where: (rv) => rv.productId === product.id && rv.status === "approved" }),
    getRelatedProducts(product.id, 8, opts.vehicle, ctx),
  ]);
  const ratingBreakdown: ProductDetail["ratingBreakdown"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const rv of reviews) ratingBreakdown[rv.rating]++;

  const path: Category[] = [];
  for (let c: Category | undefined = category; c; c = c.parentId ? ctx.categories.get(c.parentId) : undefined) {
    path.unshift(c);
    if (path.length > 10) break;
  }
  return { product, brand, category, categoryPath: path, variants, defaultVariantId: defaultId.id, fitmentCount, related, ratingBreakdown };
}

export async function getProductById(id: Id): Promise<Product | null> {
  return db.products.get(id);
}

export async function getProductSummaries(ids: Id[], opts: { vehicle?: VehicleSelection } = {}): Promise<ProductSummary[]> {
  if (ids.length === 0) return [];
  const [ctx, fits] = await Promise.all([loadCatalogContext(), productIdsFitting(opts.vehicle)]);
  const byId = new Map(ctx.products.map((p) => [p.id, p]));
  const out: ProductSummary[] = [];
  for (const id of ids) {
    const p = byId.get(id);
    if (p && isListable(ctx, p)) out.push(toSummary(ctx, p, fits));
  }
  return out;
}

function summaries(ctx: CatalogContext, list: Product[], limit: number): ProductSummary[] {
  return list.slice(0, Math.max(0, limit)).map((p) => toSummary(ctx, p));
}

export async function getFeaturedProducts(limit = 8): Promise<ProductSummary[]> {
  const ctx = await loadCatalogContext();
  const list = ctx.products.filter((p) => p.isFeatured && isListable(ctx, p)).sort((a, b) => b.soldCount - a.soldCount || b.ratingAverage - a.ratingAverage || a.name.en.localeCompare(b.name.en));
  return summaries(ctx, list, limit);
}

export async function getNewArrivals(limit = 8): Promise<ProductSummary[]> {
  const ctx = await loadCatalogContext();
  const list = ctx.products.filter((p) => isListable(ctx, p)).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.name.en.localeCompare(b.name.en));
  return summaries(ctx, list, limit);
}

export async function getBestSellers(limit = 8): Promise<ProductSummary[]> {
  const ctx = await loadCatalogContext();
  const list = ctx.products.filter((p) => isListable(ctx, p)).sort((a, b) => b.soldCount - a.soldCount || b.ratingAverage - a.ratingAverage || a.name.en.localeCompare(b.name.en));
  return summaries(ctx, list, limit);
}

export async function getDeals(limit = 8): Promise<ProductSummary[]> {
  const ctx = await loadCatalogContext();
  const pct = (p: Product) =>
    Math.max(0, ...activeVariants(ctx, p.id).map((v) => (v.compareAtPrice !== undefined && v.compareAtPrice > v.price ? (v.compareAtPrice - v.price) / v.compareAtPrice : 0)));
  const list = ctx.products
    .filter((p) => isListable(ctx, p) && pct(p) > 0)
    .sort((a, b) => pct(b) - pct(a) || b.soldCount - a.soldCount);
  return summaries(ctx, list, limit);
}

export async function getRelatedProducts(productId: Id, limit = 8, vehicle?: VehicleSelection, loaded?: CatalogContext): Promise<ProductSummary[]> {
  const ctx = loaded ?? (await loadCatalogContext());
  const base = ctx.products.find((p) => p.id === productId);
  if (!base) return [];
  const fits = await productIdsFitting(vehicle);
  const baseCategories = new Set(base.categoryIds);
  const score = (p: Product) =>
    p.categoryIds.filter((c) => baseCategories.has(c)).length * 10 +
    (p.categoryId === base.categoryId ? 15 : 0) +
    (p.brandId === base.brandId ? 4 : 0) +
    p.ratingAverage +
    (fits && (p.fitment === "universal" || fits.has(p.id)) ? 6 : 0) +
    Math.min(3, p.soldCount / 100);
  const list = ctx.products
    .filter((p) => p.id !== productId && isListable(ctx, p) && p.categoryIds.some((c) => baseCategories.has(c)))
    .sort((a, b) => score(b) - score(a) || a.name.en.localeCompare(b.name.en));
  return list.slice(0, Math.max(0, limit)).map((p) => toSummary(ctx, p, fits));
}

export async function getVariantById(variantId: Id): Promise<ProductVariant | null> {
  const v = await db.variants.get(variantId);
  return v ? stripCost(v) : null;
}

/* ------------------------------------------------------------------ taxonomy */

export async function getCategoryTree(opts: { includeInactive?: boolean } = {}): Promise<CategoryNode[]> {
  const ctx = await loadCatalogContext();
  let categories = [...ctx.categories.values()];
  if (!opts.includeInactive) {
    // an inactive category hides its whole subtree
    const hidden = new Set<Id>();
    for (const c of categories.filter((x) => !x.isActive)) for (const id of categorySubtree(categories, c.id)) hidden.add(id);
    categories = categories.filter((c) => !hidden.has(c.id));
  }
  const listable = ctx.products.filter((p) => isListable(ctx, p));
  const count = (subtree: Set<Id>) => listable.filter((p) => p.categoryIds.some((c) => subtree.has(c))).length;
  return buildCategoryTree(categories, count);
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const c = await db.categories.findOne((x) => x.slug === slug && x.isActive);
  return c;
}

export async function getCategoryById(id: Id): Promise<Category | null> {
  return db.categories.get(id);
}

export async function getCategoryPath(categoryId: Id): Promise<Category[]> {
  const all = new Map((await db.categories.all()).map((c) => [c.id, c]));
  const path: Category[] = [];
  for (let c = all.get(categoryId); c; c = c.parentId ? all.get(c.parentId) : undefined) {
    path.unshift(c);
    if (path.length > 10) break;
  }
  return path;
}

export async function listBrands(opts: { featuredOnly?: boolean; includeInactive?: boolean } = {}): Promise<(Brand & { productCount: number })[]> {
  const ctx = await loadCatalogContext();
  const counts = new Map<Id, number>();
  for (const p of ctx.products) if (isListable(ctx, p)) counts.set(p.brandId, (counts.get(p.brandId) ?? 0) + 1);
  return [...ctx.brands.values()]
    .filter((b) => (opts.includeInactive || b.isActive) && (!opts.featuredOnly || b.isFeatured))
    .map((b) => ({ ...b, productCount: counts.get(b.id) ?? 0 }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export async function getBrandBySlug(slug: string): Promise<Brand | null> {
  return db.brands.findOne((b) => b.slug === slug && b.isActive);
}

export async function getBrandById(id: Id): Promise<Brand | null> {
  return db.brands.get(id);
}

export async function listSitemapEntries(): Promise<{
  products: { slug: string; updatedAt: string }[];
  categories: { slug: string; updatedAt: string }[];
  brands: { slug: string; updatedAt: string }[];
}> {
  const ctx = await loadCatalogContext();
  return {
    products: ctx.products.filter((p) => isListable(ctx, p)).map((p) => ({ slug: p.slug, updatedAt: p.updatedAt })),
    categories: [...ctx.categories.values()].filter((c) => c.isActive).map((c) => ({ slug: c.slug, updatedAt: c.updatedAt })),
    brands: [...ctx.brands.values()].filter((b) => b.isActive).map((b) => ({ slug: b.slug, updatedAt: b.updatedAt })),
  };
}

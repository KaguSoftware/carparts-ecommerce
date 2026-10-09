import "server-only";
import { db } from "@/lib/db";
import type { Brand, Category, CategoryNode, Id, Product, ProductImage, ProductSummary, ProductVariant, StockStatus, VariantView, VehicleSelection } from "@/lib/types/domain";
import { compact, fold, tokenize, type SearchDoc } from "./_text";
import { availableOf, getStockStatus } from "./inventory";
import { resolveSelection, selectionIsEmpty } from "./vehicles";

/**
 * Shared read model for catalog, search, wishlist and dashboard code. Loads whole collections (they live in
 * memory in the JSON store) and derives summaries. Not part of the public service contract.
 */

export interface CatalogContext {
  products: Product[];
  variantsByProduct: Map<Id, ProductVariant[]>;
  brands: Map<Id, Brand>;
  categories: Map<Id, Category>;
}

export async function loadCatalogContext(): Promise<CatalogContext> {
  const [products, variants, brands, categories] = await Promise.all([db.products.all(), db.variants.all(), db.brands.all(), db.categories.all()]);
  const variantsByProduct = new Map<Id, ProductVariant[]>();
  for (const v of variants) {
    const list = variantsByProduct.get(v.productId);
    if (list) list.push(v);
    else variantsByProduct.set(v.productId, [v]);
  }
  for (const list of variantsByProduct.values()) list.sort((a, b) => a.sortOrder - b.sortOrder || a.sku.localeCompare(b.sku));
  return { products, variantsByProduct, brands: new Map(brands.map((b) => [b.id, b])), categories: new Map(categories.map((c) => [c.id, c])) };
}

export const activeVariants = (ctx: CatalogContext, productId: Id): ProductVariant[] => (ctx.variantsByProduct.get(productId) ?? []).filter((v) => v.isActive);

/** Visible on the storefront: active product, brand + primary category exist, at least one active variant. */
export function isListable(ctx: CatalogContext, p: Product): boolean {
  return p.status === "active" && ctx.brands.has(p.brandId) && ctx.categories.has(p.categoryId) && activeVariants(ctx, p.id).length > 0;
}

/** Customer-facing variant: derived availability, cost price removed. */
export function toVariantView(v: ProductVariant): VariantView {
  const available = availableOf(v);
  const { cost: _cost, ...rest } = v;
  void _cost;
  return { ...rest, available, stockStatus: getStockStatus(available, v.lowStockThreshold) };
}

export function stripCost(v: ProductVariant): ProductVariant {
  const { cost: _cost, ...rest } = v;
  void _cost;
  return rest;
}

export const sortedImages = (p: Product): ProductImage[] => [...p.images].sort((a, b) => a.sortOrder - b.sortOrder);

/** Cheapest active variant, preferring the default one on ties. */
export function cheapestVariant(variants: ProductVariant[]): ProductVariant | undefined {
  return [...variants].sort((a, b) => a.price - b.price || Number(b.isDefault) - Number(a.isDefault) || a.sortOrder - b.sortOrder)[0];
}

export function defaultVariant(variants: ProductVariant[]): ProductVariant | undefined {
  return variants.find((v) => v.isDefault) ?? cheapestVariant(variants);
}

export function productStockStatus(variants: ProductVariant[]): StockStatus {
  const statuses = variants.map((v) => getStockStatus(availableOf(v), v.lowStockThreshold));
  if (statuses.includes("in_stock")) return "in_stock";
  if (statuses.includes("low_stock")) return "low_stock";
  return "out_of_stock";
}

/** Short, unit-bearing spec values for the card strip: skips series / condition / brand rows and long sentences. */
export function specHighlights(p: Product): ProductSummary["highlights"] {
  const skip = /series|condition|brand|warrant|approval|seri|durum|marka|garanti|onay/i;
  return p.specs
    .filter((s) => !skip.test(`${s.key.en} ${s.key.tr}`) && s.value.en.length <= 18 && /d/.test(s.value.en))
    .slice(0, 3)
    .map((s) => s.value);
}

export function toSummary(ctx: CatalogContext, p: Product, fits?: Set<Id> | null): ProductSummary {
  const variants = activeVariants(ctx, p.id);
  const cheapest = cheapestVariant(variants) as ProductVariant;
  const images = sortedImages(p);
  const brand = ctx.brands.get(p.brandId) as Brand;
  const category = ctx.categories.get(p.categoryId) as Category;
  const prices = new Set(variants.map((v) => v.price));
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    summary: p.summary,
    brand: { id: brand.id, slug: brand.slug, name: brand.name },
    category: { id: category.id, slug: category.slug, name: category.name },
    ...(images[0] ? { image: images[0] } : {}),
    ...(images[1] ? { secondImage: images[1] } : {}),
    partNumber: p.partNumber,
    highlights: specHighlights(p),
    priceFrom: cheapest.price,
    ...(cheapest.compareAtPrice !== undefined && cheapest.compareAtPrice > cheapest.price ? { compareAtFrom: cheapest.compareAtPrice } : {}),
    hasMultiplePrices: prices.size > 1,
    defaultVariantId: (defaultVariant(variants) as ProductVariant).id,
    variantCount: variants.length,
    stockStatus: productStockStatus(variants),
    ratingAverage: p.ratingAverage,
    ratingCount: p.ratingCount,
    isFeatured: p.isFeatured,
    ...(fits ? { fitsSelectedVehicle: p.fitment === "universal" || fits.has(p.id) } : {}),
    createdAt: p.createdAt,
  };
}

/**
 * Product ids that fit the (possibly partial) selection, or null when no usable selection is active.
 * Universal parts are NOT included here; callers add them (`p.fitment === "universal"`).
 */
export async function productIdsFitting(selection: VehicleSelection | undefined | null): Promise<Set<Id> | null> {
  if (selectionIsEmpty(selection)) return null;
  const vehicleIds = await resolveSelection(selection as VehicleSelection);
  if (vehicleIds.length === 0) return null; // stale/unknown selection: do not filter
  const set = new Set(vehicleIds);
  const rows = await db.fitment.find({ where: (f) => set.has(f.vehicleId) });
  return new Set(rows.map((r) => r.productId));
}

/** Descendant category ids (inclusive). */
export function categorySubtree(categories: Iterable<Category>, rootId: Id): Set<Id> {
  const children = new Map<Id | null, Id[]>();
  for (const c of categories) {
    const list = children.get(c.parentId);
    if (list) list.push(c.id);
    else children.set(c.parentId, [c.id]);
  }
  const out = new Set<Id>([rootId]);
  const stack = [rootId];
  while (stack.length) {
    const next = stack.pop() as Id;
    for (const child of children.get(next) ?? []) {
      if (!out.has(child)) {
        out.add(child);
        stack.push(child);
      }
    }
  }
  return out;
}

export function buildCategoryTree(categories: Category[], countFor: (subtree: Set<Id>) => number): CategoryNode[] {
  const byParent = new Map<Id | null, Category[]>();
  for (const c of categories) {
    const list = byParent.get(c.parentId);
    if (list) list.push(c);
    else byParent.set(c.parentId, [c]);
  }
  const build = (parentId: Id | null): CategoryNode[] =>
    (byParent.get(parentId) ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.en.localeCompare(b.name.en))
      .map((c) => ({ ...c, children: build(c.id), productCount: countFor(categorySubtree(categories, c.id)) }));
  // Orphans (parent missing/filtered) are promoted to roots so they stay reachable.
  const ids = new Set(categories.map((c) => c.id));
  const roots = categories.filter((c) => c.parentId !== null && !ids.has(c.parentId));
  const tree = build(null);
  for (const orphan of roots) tree.push({ ...orphan, children: build(orphan.id), productCount: countFor(categorySubtree(categories, orphan.id)) });
  return tree;
}

/* ------------------------------------------------------------------ search documents */

export function buildSearchDoc(ctx: CatalogContext, p: Product): SearchDoc {
  const variants = ctx.variantsByProduct.get(p.id) ?? [];
  const brand = ctx.brands.get(p.brandId);
  const names = [fold(p.name.en), fold(p.name.tr || p.name.en)];
  return {
    id: p.id,
    codes: [...new Set([compact(p.partNumber), ...p.oemNumbers.map(compact), ...variants.map((v) => compact(v.sku))].filter(Boolean))],
    names,
    nameWords: names.map((n) => (n ? n.split(" ") : [])),
    brand: brand ? fold(brand.name) : "",
    categories: p.categoryIds.map((id) => ctx.categories.get(id)).filter((c): c is Category => Boolean(c)).flatMap((c) => [fold(c.name.en), fold(c.name.tr || c.name.en)]),
    tags: p.tags.flatMap((t) => tokenize(t)),
    summary: fold(`${p.summary.en} ${p.summary.tr}`),
    description: fold(`${p.description.en} ${p.description.tr}`).slice(0, 4000),
  };
}

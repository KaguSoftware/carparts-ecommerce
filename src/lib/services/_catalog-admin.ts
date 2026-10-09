import "server-only";
import { z } from "zod";
import { zodFieldErrors } from "@/lib/action-result";
import { createId, db } from "@/lib/db";
import { DomainError, notFound } from "@/lib/errors";
import type { Actor, Brand, Category, Id, Paged, Product, ProductImage, ProductVariant } from "@/lib/types/domain";
import type { AdminProductFilter, AdminProductRow, BrandInput, CategoryInput, ProductInput, VariantInput } from "./contracts";
import { logAudit } from "./audit";
import { availableOf, recordInitialStock } from "./inventory";
import { diffFields, includesText, nowIso, paginate, resolveSlug } from "./_shared";
import { categorySubtree, sortedImages } from "./_catalog-data";
import { fold } from "./_text";

/* ------------------------------------------------------------------ validation */

const loc = (max: number, required = true) => {
  const base = z.string().trim().max(max, "too_long");
  return z.object({ en: required ? base.min(1, "required") : base, tr: base });
};
const optLoc = (max: number) => loc(max, false).optional();
const intMin0 = z.number({ error: "number_invalid" }).int("integer_required").min(0, "must_not_be_negative");
const money = intMin0.max(1_000_000_000, "too_large");

const productSchema = z.object({
  slug: z.string().trim().max(96, "too_long").optional(),
  name: loc(200),
  summary: loc(400),
  description: loc(20_000, false),
  brandId: z.string().min(1, "required"),
  categoryId: z.string().min(1, "required"),
  categoryIds: z.array(z.string()).max(20).optional(),
  specs: z
    .array(z.object({ key: loc(80), value: loc(200) }))
    .max(60, "too_long"),
  tags: z.array(z.string().trim().min(1).max(40, "too_long")).max(40, "too_long"),
  status: z.enum(["draft", "active", "archived"]),
  isFeatured: z.boolean(),
  partNumber: z.string().trim().min(1, "required").max(60, "too_long"),
  oemNumbers: z.array(z.string().trim().min(1).max(60, "too_long")).max(30, "too_long"),
  warrantyMonths: intMin0.max(240, "too_large"),
  fitment: z.enum(["universal", "specific"]),
  seoTitle: optLoc(120),
  seoDescription: optLoc(300),
});

const variantSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(2, "required")
    .max(40, "too_long")
    .regex(/^[A-Za-z0-9][A-Za-z0-9._\-/]*$/, "invalid_value"),
  name: loc(120),
  options: z.array(z.object({ name: loc(60), value: loc(80) })).max(8),
  price: z.number({ error: "number_invalid" }).int("integer_required").min(1, "must_be_positive").max(1_000_000_000, "too_large"),
  compareAtPrice: money.optional(),
  cost: money.optional(),
  initialStock: intMin0.max(10_000_000, "too_large").optional(),
  lowStockThreshold: intMin0.max(10_000, "too_large"),
  weightGrams: intMin0.max(1_000_000, "too_large"),
  barcode: z.string().trim().max(64, "too_long").optional(),
  imageId: z.string().optional(),
  isActive: z.boolean(),
  isDefault: z.boolean(),
  sortOrder: intMin0.max(10_000).optional(),
});

const categorySchema = z.object({
  slug: z.string().trim().max(96, "too_long").optional(),
  parentId: z.string().nullable(),
  name: loc(100),
  description: loc(1000, false),
  image: z.string().trim().max(300, "too_long").optional(),
  icon: z.string().trim().max(60, "too_long").optional(),
  sortOrder: z.number().int("integer_required").min(0).max(100_000),
  isActive: z.boolean(),
  seoTitle: optLoc(120),
  seoDescription: optLoc(300),
});

const brandSchema = z.object({
  slug: z.string().trim().max(96, "too_long").optional(),
  name: z.string().trim().min(1, "required").max(80, "too_long"),
  description: loc(1000, false),
  logo: z.string().trim().max(300, "too_long").optional(),
  country: z.string().trim().length(2, "country_invalid").toUpperCase().optional(),
  website: z.string().trim().max(300, "too_long").refine((v) => v === "" || /^https?:\/\//i.test(v), "url_invalid").optional(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  sortOrder: z.number().int("integer_required").min(0).max(100_000),
});

const imageSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "required")
    .max(500, "too_long")
    .refine((u) => /^\/(?!\/)/.test(u) || /^https:\/\//i.test(u), "url_invalid"),
  alt: loc(200, false),
  sortOrder: z.number().int().optional(),
});

function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new DomainError("validation_failed", { fieldErrors: zodFieldErrors(parsed.error) });
  return parsed.data;
}

const stripUndef = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/* ------------------------------------------------------------------ products: admin read */

export async function adminListProducts(filter: AdminProductFilter): Promise<Paged<AdminProductRow>> {
  const [products, variants, brands, categories] = await Promise.all([db.products.all(), db.variants.all(), db.brands.all(), db.categories.all()]);
  const brandMap = new Map(brands.map((b) => [b.id, b]));
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const vByProduct = new Map<Id, ProductVariant[]>();
  for (const v of variants) vByProduct.set(v.productId, [...(vByProduct.get(v.productId) ?? []), v]);
  const q = filter.q?.trim();
  const qFolded = q ? fold(q) : "";
  const catSubtree = filter.categoryId ? categorySubtree(categories, filter.categoryId) : null;

  const rows: AdminProductRow[] = [];
  for (const p of products) {
    if (filter.status && filter.status !== "all" && p.status !== filter.status) continue;
    if (filter.brandId && p.brandId !== filter.brandId) continue;
    if (catSubtree && !p.categoryIds.some((c) => catSubtree.has(c))) continue;
    const vs = vByProduct.get(p.id) ?? [];
    if (q) {
      const skus = vs.map((v) => v.sku);
      const hit =
        includesText([p.name.en, p.name.tr, p.partNumber, p.slug, ...skus, ...p.oemNumbers, brandMap.get(p.brandId)?.name], q) ||
        fold(`${p.name.en} ${p.name.tr}`).includes(qFolded);
      if (!hit) continue;
    }
    const active = vs.filter((v) => v.isActive);
    const lowStock = active.some((v) => availableOf(v) <= v.lowStockThreshold);
    if (filter.lowStockOnly && !lowStock) continue;
    rows.push({
      product: p,
      brandName: brandMap.get(p.brandId)?.name ?? "",
      categoryName: catMap.get(p.categoryId)?.name ?? { en: "", tr: "" },
      variantCount: vs.length,
      priceFrom: active.length ? Math.min(...active.map((v) => v.price)) : vs.length ? Math.min(...vs.map((v) => v.price)) : 0,
      totalAvailable: active.reduce((s, v) => s + availableOf(v), 0),
      lowStock,
      image: sortedImages(p)[0],
    });
  }

  switch (filter.sort ?? "updated_desc") {
    case "name_asc":
      rows.sort((a, b) => a.product.name.en.localeCompare(b.product.name.en));
      break;
    case "price_asc":
      rows.sort((a, b) => a.priceFrom - b.priceFrom);
      break;
    case "price_desc":
      rows.sort((a, b) => b.priceFrom - a.priceFrom);
      break;
    case "stock_asc":
      rows.sort((a, b) => a.totalAvailable - b.totalAvailable || a.product.name.en.localeCompare(b.product.name.en));
      break;
    case "sold_desc":
      rows.sort((a, b) => b.product.soldCount - a.product.soldCount);
      break;
    default:
      rows.sort((a, b) => b.product.updatedAt.localeCompare(a.product.updatedAt));
  }
  return paginate(rows, filter, 25);
}

export async function adminGetProduct(id: Id): Promise<{ product: Product; variants: ProductVariant[] } | null> {
  const product = await db.products.get(id);
  if (!product) return null;
  const variants = await db.variants.find({ where: (v) => v.productId === id, orderBy: [{ field: "sortOrder", direction: "asc" }] });
  return { product, variants };
}

/* ------------------------------------------------------------------ products: writes */

async function assertRefs(brandId: Id | undefined, categoryIds: Id[] | undefined) {
  if (brandId && !(await db.brands.get(brandId))) throw new DomainError("validation_failed", { fieldErrors: { brandId: ["invalid_value"] } });
  if (categoryIds?.length) {
    const found = await db.categories.getMany(categoryIds);
    if (found.length !== new Set(categoryIds).size) throw new DomainError("validation_failed", { fieldErrors: { categoryId: ["invalid_value"] } });
  }
}

function withPrimaryCategory(categoryId: Id, categoryIds?: Id[]): Id[] {
  return [categoryId, ...(categoryIds ?? []).filter((c) => c !== categoryId)];
}

const PRODUCT_AUDIT_FIELDS = ["slug", "name", "brandId", "categoryId", "status", "isFeatured", "partNumber", "fitment", "warrantyMonths", "tags"] as const;

export async function createProduct(input: ProductInput, actor: Actor): Promise<Product> {
  const data = parse(productSchema, input);
  return db.transaction(async () => {
    const categoryIds = withPrimaryCategory(data.categoryId, data.categoryIds);
    await assertRefs(data.brandId, categoryIds);
    const existing = await db.products.all();
    const taken = new Set(existing.map((p) => p.slug));
    const slug = resolveSlug({ desired: data.slug, fallbackText: data.name.en, taken: (s) => taken.has(s) });
    const at = nowIso();
    const product = await db.products.insert({
      slug,
      name: data.name,
      summary: data.summary,
      description: data.description,
      brandId: data.brandId,
      categoryId: data.categoryId,
      categoryIds,
      images: [],
      specs: data.specs,
      tags: data.tags,
      status: data.status,
      isFeatured: data.isFeatured,
      partNumber: data.partNumber,
      oemNumbers: data.oemNumbers,
      warrantyMonths: data.warrantyMonths,
      fitment: data.fitment,
      ratingAverage: 0,
      ratingCount: 0,
      soldCount: 0,
      ...(data.seoTitle ? { seoTitle: data.seoTitle } : {}),
      ...(data.seoDescription ? { seoDescription: data.seoDescription } : {}),
      createdAt: at,
      updatedAt: at,
    });
    await logAudit({ actor, action: "product.create", entityType: "product", entityId: product.id, summary: `Created product ${product.name.en}` });
    return product;
  });
}

export async function updateProduct(id: Id, input: Partial<ProductInput>, actor: Actor): Promise<Product> {
  const patch = parse(productSchema.partial(), input);
  return db.transaction(async () => {
    const current = await db.products.get(id);
    if (!current) throw notFound("product");
    const categoryId = patch.categoryId ?? current.categoryId;
    const categoryIds = withPrimaryCategory(categoryId, patch.categoryIds ?? current.categoryIds);
    await assertRefs(patch.brandId, patch.categoryId || patch.categoryIds ? categoryIds : undefined);

    let slug = current.slug;
    if (patch.slug !== undefined && patch.slug !== "" && patch.slug !== current.slug) {
      const others = await db.products.find({ where: (p) => p.id !== id });
      const taken = new Set(others.map((p) => p.slug));
      slug = resolveSlug({ desired: patch.slug, fallbackText: current.name.en, taken: (s) => taken.has(s) });
    }
    const { slug: _slug, categoryIds: _cids, ...rest } = patch;
    void _slug;
    void _cids;
    const saved = await db.products.update(id, { ...stripUndef(rest), slug, categoryId, categoryIds, updatedAt: nowIso() });
    await logAudit({
      actor,
      action: current.status !== saved.status ? "product.status_change" : "product.update",
      entityType: "product",
      entityId: id,
      summary: `Updated product ${saved.name.en}`,
      changes: diffFields(current, saved, PRODUCT_AUDIT_FIELDS),
    });
    return saved;
  });
}

export async function setProductStatus(id: Id, status: Product["status"], actor: Actor): Promise<Product> {
  if (!["draft", "active", "archived"].includes(status)) throw new DomainError("validation_failed");
  return db.transaction(async () => {
    const current = await db.products.get(id);
    if (!current) throw notFound("product");
    const saved = await db.products.update(id, { status, updatedAt: nowIso() });
    await logAudit({
      actor,
      action: "product.status_change",
      entityType: "product",
      entityId: id,
      summary: `${saved.name.en}: ${current.status} -> ${status}`,
      changes: { status: { from: current.status, to: status } },
    });
    return saved;
  });
}

export async function deleteProduct(id: Id, actor: Actor): Promise<{ deleted: boolean; archived: boolean }> {
  return db.transaction(async () => {
    const product = await db.products.get(id);
    if (!product) throw notFound("product");
    const ordered = await db.orders.findOne((o) => o.items.some((i) => i.productId === id));
    if (ordered) {
      await db.products.update(id, { status: "archived", updatedAt: nowIso() });
      await logAudit({ actor, action: "product.archive", entityType: "product", entityId: id, summary: `Archived ${product.name.en} (has order history)` });
      return { deleted: false, archived: true };
    }
    await db.variants.deleteWhere((v) => v.productId === id);
    await db.fitment.deleteWhere((f) => f.productId === id);
    const reviewIds = new Set((await db.reviews.find({ where: (r) => r.productId === id })).map((r) => r.id));
    await db.reviews.deleteWhere((r) => r.productId === id);
    await db.reviewVotes.deleteWhere((v) => reviewIds.has(v.reviewId));
    const wishlists = await db.wishlists.find({ where: (w) => w.productIds.includes(id) });
    for (const w of wishlists) await db.wishlists.update(w.id, { productIds: w.productIds.filter((p) => p !== id), updatedAt: nowIso() });
    await db.products.delete(id);
    await logAudit({ actor, action: "product.delete", entityType: "product", entityId: id, summary: `Deleted product ${product.name.en}` });
    return { deleted: true, archived: false };
  });
}

export async function setProductImages(productId: Id, images: Omit<ProductImage, "id">[], actor: Actor): Promise<ProductImage[]> {
  if (!Array.isArray(images) || images.length > 12) throw new DomainError("validation_failed", { fieldErrors: { images: ["too_long"] } });
  const parsed = images.map((img, i) => ({ ...parse(imageSchema, img), sortOrder: i }));
  return db.transaction(async () => {
    const product = await db.products.get(productId);
    if (!product) throw notFound("product");
    // keep ids of images that stay (same url), mint ids for new ones
    const byUrl = new Map(product.images.map((img) => [img.url, img]));
    const next: ProductImage[] = parsed.map((img, i) => ({ id: byUrl.get(img.url)?.id ?? createId("img"), url: img.url, alt: img.alt, sortOrder: i }));
    await db.products.update(productId, { images: next, updatedAt: nowIso() });
    const keep = new Set(next.map((i) => i.id));
    const variants = await db.variants.find({ where: (v) => v.productId === productId && v.imageId !== undefined && !keep.has(v.imageId) });
    for (const v of variants) await db.variants.update(v.id, { imageId: undefined, updatedAt: nowIso() });
    await logAudit({ actor, action: "product.images", entityType: "product", entityId: productId, summary: `Set ${next.length} image(s) on ${product.name.en}`, changes: { images: { from: product.images.length, to: next.length } } });
    return next;
  });
}

/* ------------------------------------------------------------------ variants */

async function ensureDefaultVariant(productId: Id, preferred?: Id) {
  const variants = await db.variants.find({ where: (v) => v.productId === productId });
  if (variants.length === 0) return;
  const defaults = variants.filter((v) => v.isDefault);
  let chosen: ProductVariant | undefined = preferred ? variants.find((v) => v.id === preferred) : undefined;
  if (!chosen) chosen = defaults[0] ?? variants.filter((v) => v.isActive).sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? variants[0];
  for (const v of variants) {
    const shouldBeDefault = v.id === chosen?.id;
    if (v.isDefault !== shouldBeDefault) await db.variants.update(v.id, { isDefault: shouldBeDefault, updatedAt: nowIso() });
  }
}

async function assertSkuFree(sku: string, exceptId?: Id) {
  const lower = sku.toLowerCase();
  const dup = await db.variants.findOne((v) => v.id !== exceptId && v.sku.toLowerCase() === lower);
  if (dup) throw new DomainError("sku_taken", { status: 409 });
}

function assertPricing(price: number, compareAt: number | undefined) {
  if (compareAt !== undefined && compareAt > 0 && compareAt <= price) {
    throw new DomainError("validation_failed", { fieldErrors: { compareAtPrice: ["invalid_value"] } });
  }
}

export async function createVariant(productId: Id, input: VariantInput, actor: Actor): Promise<ProductVariant> {
  const data = parse(variantSchema, input);
  return db.transaction(async () => {
    const product = await db.products.get(productId);
    if (!product) throw notFound("product");
    await assertSkuFree(data.sku);
    assertPricing(data.price, data.compareAtPrice);
    if (data.imageId && !product.images.some((i) => i.id === data.imageId)) throw new DomainError("validation_failed", { fieldErrors: { imageId: ["invalid_value"] } });
    const siblings = await db.variants.find({ where: (v) => v.productId === productId });
    const at = nowIso();
    const { initialStock, ...rest } = data;
    const variant = await db.variants.insert({
      ...stripUndef(rest),
      productId,
      stockOnHand: initialStock ?? 0,
      stockReserved: 0,
      sortOrder: data.sortOrder ?? siblings.length,
      isDefault: data.isDefault || siblings.length === 0,
      compareAtPrice: data.compareAtPrice && data.compareAtPrice > 0 ? data.compareAtPrice : undefined,
      createdAt: at,
      updatedAt: at,
    } as Omit<ProductVariant, "id">);
    await recordInitialStock(variant, actor);
    if (variant.isDefault) await ensureDefaultVariant(productId, variant.id);
    await db.products.update(productId, { updatedAt: at });
    await logAudit({ actor, action: "variant.create", entityType: "variant", entityId: variant.id, summary: `Created variant ${variant.sku} of ${product.name.en}` });
    return (await db.variants.get(variant.id)) as ProductVariant;
  });
}

export async function updateVariant(variantId: Id, input: Partial<VariantInput>, actor: Actor): Promise<ProductVariant> {
  const patch = parse(variantSchema.partial(), input);
  return db.transaction(async () => {
    const current = await db.variants.get(variantId);
    if (!current) throw notFound("variant");
    const product = (await db.products.get(current.productId)) as Product;
    if (patch.sku !== undefined) await assertSkuFree(patch.sku, variantId);
    const price = patch.price ?? current.price;
    const compareAt = "compareAtPrice" in input ? patch.compareAtPrice : current.compareAtPrice;
    assertPricing(price, compareAt);
    if (patch.imageId && !product.images.some((i) => i.id === patch.imageId)) throw new DomainError("validation_failed", { fieldErrors: { imageId: ["invalid_value"] } });

    const { initialStock: _ignored, isDefault, ...rest } = patch;
    void _ignored;
    const changes: Partial<ProductVariant> = { ...stripUndef(rest), updatedAt: nowIso() };
    // keys explicitly passed as undefined clear optional fields
    for (const key of ["compareAtPrice", "cost", "barcode", "imageId"] as const) if (key in input && input[key] === undefined) changes[key] = undefined;
    if (compareAt !== undefined && compareAt <= 0) changes.compareAtPrice = undefined;
    const saved = await db.variants.update(variantId, changes);
    if (isDefault === true) await ensureDefaultVariant(current.productId, variantId);
    else if (isDefault === false && current.isDefault) await ensureDefaultVariant(current.productId);
    await db.products.update(current.productId, { updatedAt: nowIso() });
    await logAudit({
      actor,
      action: "variant.update",
      entityType: "variant",
      entityId: variantId,
      summary: `Updated variant ${saved.sku}`,
      changes: diffFields(current, saved, ["sku", "price", "compareAtPrice", "cost", "isActive", "isDefault", "lowStockThreshold", "weightGrams"]),
    });
    return (await db.variants.get(variantId)) as ProductVariant;
  });
}

export async function deleteVariant(variantId: Id, actor: Actor): Promise<{ deleted: boolean; deactivated: boolean }> {
  return db.transaction(async () => {
    const variant = await db.variants.get(variantId);
    if (!variant) throw notFound("variant");
    const ordered = await db.orders.findOne((o) => o.items.some((i) => i.variantId === variantId));
    if (ordered || variant.stockReserved > 0) {
      await db.variants.update(variantId, { isActive: false, updatedAt: nowIso() });
      await ensureDefaultVariant(variant.productId);
      await logAudit({ actor, action: "variant.deactivate", entityType: "variant", entityId: variantId, summary: `Deactivated variant ${variant.sku} (has order history)` });
      return { deleted: false, deactivated: true };
    }
    await db.variants.delete(variantId);
    await ensureDefaultVariant(variant.productId);
    await logAudit({ actor, action: "variant.delete", entityType: "variant", entityId: variantId, summary: `Deleted variant ${variant.sku}` });
    return { deleted: true, deactivated: false };
  });
}

/* ------------------------------------------------------------------ categories */

export async function createCategory(input: CategoryInput, actor: Actor): Promise<Category> {
  const data = parse(categorySchema, input);
  return db.transaction(async () => {
    if (data.parentId && !(await db.categories.get(data.parentId))) throw new DomainError("validation_failed", { fieldErrors: { parentId: ["invalid_value"] } });
    const taken = new Set((await db.categories.all()).map((c) => c.slug));
    const slug = resolveSlug({ desired: data.slug, fallbackText: data.name.en, taken: (s) => taken.has(s) });
    const at = nowIso();
    const { slug: _s, ...rest } = data;
    void _s;
    const category = await db.categories.insert({ ...stripUndef(rest), slug, createdAt: at, updatedAt: at });
    await logAudit({ actor, action: "category.create", entityType: "category", entityId: category.id, summary: `Created category ${category.name.en}` });
    return category;
  });
}

export async function updateCategory(id: Id, input: Partial<CategoryInput>, actor: Actor): Promise<Category> {
  const patch = parse(categorySchema.partial(), input);
  return db.transaction(async () => {
    const current = await db.categories.get(id);
    if (!current) throw notFound("category");
    const all = await db.categories.all();
    if (patch.parentId !== undefined && patch.parentId !== null) {
      if (!all.some((c) => c.id === patch.parentId)) throw new DomainError("validation_failed", { fieldErrors: { parentId: ["invalid_value"] } });
      if (categorySubtree(all, id).has(patch.parentId)) throw new DomainError("validation_failed", { fieldErrors: { parentId: ["invalid_value"] } });
    }
    let slug = current.slug;
    if (patch.slug && patch.slug !== current.slug) {
      const taken = new Set(all.filter((c) => c.id !== id).map((c) => c.slug));
      slug = resolveSlug({ desired: patch.slug, fallbackText: current.name.en, taken: (s) => taken.has(s) });
    }
    const { slug: _s, ...rest } = patch;
    void _s;
    const clear: Partial<Category> = {};
    for (const key of ["image", "icon", "seoTitle", "seoDescription"] as const) if (key in input && input[key] === undefined) clear[key] = undefined;
    const saved = await db.categories.update(id, { ...clear, ...stripUndef(rest), slug, updatedAt: nowIso() });
    await logAudit({
      actor,
      action: "category.update",
      entityType: "category",
      entityId: id,
      summary: `Updated category ${saved.name.en}`,
      changes: diffFields(current, saved, ["slug", "parentId", "name", "isActive", "sortOrder"]),
    });
    return saved;
  });
}

export async function deleteCategory(id: Id, actor: Actor): Promise<void> {
  await db.transaction(async () => {
    const current = await db.categories.get(id);
    if (!current) throw notFound("category");
    const hasChildren = await db.categories.findOne((c) => c.parentId === id);
    const hasProducts = await db.products.findOne((p) => p.categoryIds.includes(id) || p.categoryId === id);
    if (hasChildren || hasProducts) throw new DomainError("in_use", { status: 409 });
    await db.categories.delete(id);
    await logAudit({ actor, action: "category.delete", entityType: "category", entityId: id, summary: `Deleted category ${current.name.en}` });
  });
}

/* ------------------------------------------------------------------ brands */

export async function createBrand(input: BrandInput, actor: Actor): Promise<Brand> {
  const data = parse(brandSchema, input);
  return db.transaction(async () => {
    const all = await db.brands.all();
    if (all.some((b) => b.name.toLowerCase() === data.name.toLowerCase())) throw new DomainError("slug_taken", { status: 409 });
    const taken = new Set(all.map((b) => b.slug));
    const slug = resolveSlug({ desired: data.slug, fallbackText: data.name, taken: (s) => taken.has(s) });
    const at = nowIso();
    const { slug: _s, ...rest } = data;
    void _s;
    const brand = await db.brands.insert({ ...stripUndef(rest), slug, createdAt: at, updatedAt: at });
    await logAudit({ actor, action: "brand.create", entityType: "brand", entityId: brand.id, summary: `Created brand ${brand.name}` });
    return brand;
  });
}

export async function updateBrand(id: Id, input: Partial<BrandInput>, actor: Actor): Promise<Brand> {
  const patch = parse(brandSchema.partial(), input);
  return db.transaction(async () => {
    const current = await db.brands.get(id);
    if (!current) throw notFound("brand");
    const others = (await db.brands.all()).filter((b) => b.id !== id);
    if (patch.name && others.some((b) => b.name.toLowerCase() === patch.name?.toLowerCase())) throw new DomainError("slug_taken", { status: 409 });
    let slug = current.slug;
    if (patch.slug && patch.slug !== current.slug) {
      const taken = new Set(others.map((b) => b.slug));
      slug = resolveSlug({ desired: patch.slug, fallbackText: current.name, taken: (s) => taken.has(s) });
    }
    const { slug: _s, ...rest } = patch;
    void _s;
    const clear: Partial<Brand> = {};
    for (const key of ["logo", "country", "website"] as const) if (key in input && input[key] === undefined) clear[key] = undefined;
    const saved = await db.brands.update(id, { ...clear, ...stripUndef(rest), slug, updatedAt: nowIso() });
    await logAudit({
      actor,
      action: "brand.update",
      entityType: "brand",
      entityId: id,
      summary: `Updated brand ${saved.name}`,
      changes: diffFields(current, saved, ["slug", "name", "isActive", "isFeatured", "sortOrder", "country"]),
    });
    return saved;
  });
}

export async function deleteBrand(id: Id, actor: Actor): Promise<void> {
  await db.transaction(async () => {
    const current = await db.brands.get(id);
    if (!current) throw notFound("brand");
    if (await db.products.findOne((p) => p.brandId === id)) throw new DomainError("in_use", { status: 409 });
    await db.brands.delete(id);
    await logAudit({ actor, action: "brand.delete", entityType: "brand", entityId: id, summary: `Deleted brand ${current.name}` });
  });
}

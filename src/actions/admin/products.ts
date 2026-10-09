"use server";

import { createProduct, createVariant, deleteProduct, deleteVariant, setProductImages, setProductStatus, updateProduct, updateVariant } from "@/lib/services/catalog";
import { listVariantStock } from "@/lib/services/inventory";
import type { ProductInput, VariantInput } from "@/lib/services/contracts";
import { adminAction, prefixFieldErrors, refresh } from "./_shared";
import {
  bulkProductsSchema,
  createProductSchema,
  deleteProductSchema,
  deleteVariantSchema,
  saveVariantSchema,
  searchStockSchema,
  setImagesSchema,
  updateProductSchema,
  type ProductFormInput,
  type VariantFormInput,
} from "./products.schema";

function toProductInput(p: ProductFormInput): ProductInput {
  const optionalLoc = (v: { en: string; tr: string }) => (v.en || v.tr ? v : undefined);
  const seoTitle = optionalLoc(p.seoTitle);
  const seoDescription = optionalLoc(p.seoDescription);
  return {
    ...(p.slug ? { slug: p.slug } : {}),
    name: p.name,
    summary: p.summary,
    description: p.description,
    brandId: p.brandId,
    categoryId: p.categoryId,
    categoryIds: [...new Set([p.categoryId, ...p.categoryIds])],
    specs: p.specs,
    tags: p.tags,
    status: p.status,
    isFeatured: p.isFeatured,
    partNumber: p.partNumber,
    oemNumbers: p.oemNumbers,
    warrantyMonths: p.warrantyMonths,
    fitment: p.fitment,
    ...(seoTitle ? { seoTitle } : {}),
    ...(seoDescription ? { seoDescription } : {}),
  };
}

function toVariantInput(v: VariantFormInput, opts: { create: boolean }): VariantInput {
  return {
    sku: v.sku,
    name: v.name,
    options: v.options,
    price: v.price,
    ...(v.compareAtPrice ? { compareAtPrice: v.compareAtPrice } : {}),
    ...(v.cost ? { cost: v.cost } : {}),
    ...(opts.create ? { initialStock: v.initialStock ?? 0 } : {}),
    lowStockThreshold: v.lowStockThreshold,
    weightGrams: v.weightGrams,
    ...(v.barcode ? { barcode: v.barcode } : {}),
    ...(v.imageId ? { imageId: v.imageId } : {}),
    isActive: v.isActive,
    isDefault: v.isDefault,
  };
}

const PRODUCT_PATHS = ["/admin/products", "/admin/inventory", "/admin"];

/** Creates the product and its first variant together; if the variant is rejected the product is rolled back. */
export async function createProductAction(raw: unknown) {
  return adminAction("catalog.write", createProductSchema, raw, async ({ product, variant }, { actor }) => {
    const created = await createProduct(toProductInput(product), actor).catch((e) => prefixFieldErrors(e, "product"));
    try {
      await createVariant(created.id, toVariantInput({ ...variant, isDefault: true }, { create: true }), actor);
    } catch (error) {
      await deleteProduct(created.id, actor).catch(() => undefined);
      return prefixFieldErrors(error, "variant");
    }
    refresh(PRODUCT_PATHS, { store: true });
    return { id: created.id };
  });
}

export async function updateProductAction(raw: unknown) {
  return adminAction("catalog.write", updateProductSchema, raw, async ({ id, product }, { actor }) => {
    await updateProduct(id, toProductInput(product), actor).catch((e) => prefixFieldErrors(e, "product"));
    refresh([...PRODUCT_PATHS, `/admin/products/${id}`], { store: true });
    return { id };
  });
}

export async function deleteProductAction(raw: unknown) {
  return adminAction("catalog.write", deleteProductSchema, raw, async ({ id }, { actor }) => {
    const result = await deleteProduct(id, actor);
    refresh(PRODUCT_PATHS, { store: true });
    return result;
  });
}

/** Status / featured / delete for many products at once. Returns how many changed and which ones failed. */
export async function bulkProductsAction(raw: unknown) {
  return adminAction("catalog.write", bulkProductsSchema, raw, async ({ ids, op }, { actor }) => {
    let done = 0;
    let archived = 0;
    const failed: string[] = [];
    for (const id of ids) {
      try {
        if (op === "publish") await setProductStatus(id, "active", actor);
        else if (op === "draft") await setProductStatus(id, "draft", actor);
        else if (op === "archive") await setProductStatus(id, "archived", actor);
        else if (op === "feature") await updateProduct(id, { isFeatured: true }, actor);
        else if (op === "unfeature") await updateProduct(id, { isFeatured: false }, actor);
        else {
          const result = await deleteProduct(id, actor);
          if (result.archived) archived++;
        }
        done++;
      } catch {
        failed.push(id);
      }
    }
    refresh(PRODUCT_PATHS, { store: true });
    return { done, archived, failed: failed.length };
  });
}

export async function saveVariantAction(raw: unknown) {
  return adminAction("catalog.write", saveVariantSchema, raw, async ({ productId, variantId, variant }, { actor }) => {
    const saved = variantId
      ? await updateVariant(variantId, toVariantInput(variant, { create: false }), actor).catch((e) => prefixFieldErrors(e, "variant"))
      : await createVariant(productId, toVariantInput(variant, { create: true }), actor).catch((e) => prefixFieldErrors(e, "variant"));
    refresh([...PRODUCT_PATHS, `/admin/products/${productId}`], { store: true });
    return { id: saved.id };
  });
}

export async function deleteVariantAction(raw: unknown) {
  return adminAction("catalog.write", deleteVariantSchema, raw, async ({ variantId }, { actor }) => {
    const result = await deleteVariant(variantId, actor);
    refresh(PRODUCT_PATHS, { store: true });
    return result;
  });
}

export async function setProductImagesAction(raw: unknown) {
  return adminAction("catalog.write", setImagesSchema, raw, async ({ productId, images }, { actor }) => {
    const saved = await setProductImages(
      productId,
      images.map((image, index) => ({ url: image.url, alt: image.alt, sortOrder: index })),
      actor,
    );
    refresh([...PRODUCT_PATHS, `/admin/products/${productId}`], { store: true });
    return saved;
  });
}

/** Variant picker for stock adjustments (SKU / product name search). */
export async function searchVariantsAction(raw: unknown) {
  return adminAction("catalog.read", searchStockSchema, raw, async ({ q }) => {
    const result = await listVariantStock({ q, pageSize: 8 });
    return result.items;
  });
}

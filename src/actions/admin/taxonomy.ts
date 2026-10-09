"use server";

import { createBrand, createCategory, deleteBrand, deleteCategory, updateBrand, updateCategory } from "@/lib/services/catalog";
import type { BrandInput, CategoryInput } from "@/lib/services/contracts";
import { adminAction, prefixFieldErrors, refresh } from "./_shared";
import { deleteByIdSchema, saveBrandSchema, saveCategorySchema, type BrandFormInput, type CategoryFormInput } from "./taxonomy.schema";

const optionalLoc = (v: { en: string; tr: string }) => (v.en || v.tr ? v : undefined);

function toCategoryInput(c: CategoryFormInput): CategoryInput {
  const seoTitle = optionalLoc(c.seoTitle);
  const seoDescription = optionalLoc(c.seoDescription);
  return {
    ...(c.slug ? { slug: c.slug } : {}),
    parentId: c.parentId || null,
    name: c.name,
    description: c.description,
    ...(c.image ? { image: c.image } : {}),
    ...(c.icon ? { icon: c.icon } : {}),
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    ...(seoTitle ? { seoTitle } : {}),
    ...(seoDescription ? { seoDescription } : {}),
  };
}

function toBrandInput(b: BrandFormInput): BrandInput {
  return {
    ...(b.slug ? { slug: b.slug } : {}),
    name: b.name,
    description: b.description,
    ...(b.logo ? { logo: b.logo } : {}),
    ...(b.country ? { country: b.country.toUpperCase() } : {}),
    ...(b.website ? { website: b.website } : {}),
    isActive: b.isActive,
    isFeatured: b.isFeatured,
    sortOrder: b.sortOrder,
  };
}

export async function saveCategoryAction(raw: unknown) {
  return adminAction("catalog.write", saveCategorySchema, raw, async ({ id, category }, { actor }) => {
    const saved = id
      ? await updateCategory(id, toCategoryInput(category), actor).catch((e) => prefixFieldErrors(e, "category"))
      : await createCategory(toCategoryInput(category), actor).catch((e) => prefixFieldErrors(e, "category"));
    refresh(["/admin/categories", "/admin/products"], { store: true });
    return { id: saved.id };
  });
}

export async function deleteCategoryAction(raw: unknown) {
  return adminAction("catalog.write", deleteByIdSchema, raw, async ({ id }, { actor }) => {
    await deleteCategory(id, actor);
    refresh(["/admin/categories", "/admin/products"], { store: true });
  });
}

export async function saveBrandAction(raw: unknown) {
  return adminAction("catalog.write", saveBrandSchema, raw, async ({ id, brand }, { actor }) => {
    const saved = id
      ? await updateBrand(id, toBrandInput(brand), actor).catch((e) => prefixFieldErrors(e, "brand"))
      : await createBrand(toBrandInput(brand), actor).catch((e) => prefixFieldErrors(e, "brand"));
    refresh(["/admin/brands", "/admin/products"], { store: true });
    return { id: saved.id };
  });
}

export async function deleteBrandAction(raw: unknown) {
  return adminAction("catalog.write", deleteByIdSchema, raw, async ({ id }, { actor }) => {
    await deleteBrand(id, actor);
    refresh(["/admin/brands", "/admin/products"], { store: true });
  });
}

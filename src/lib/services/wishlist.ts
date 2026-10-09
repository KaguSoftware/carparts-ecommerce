import "server-only";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import type { Id, ProductSummary } from "@/lib/types/domain";
import { nowIso } from "./_shared";
import { getProductSummaries } from "./catalog";

const MAX_ITEMS = 200;

export async function getWishlistIds(userId: Id): Promise<Id[]> {
  const list = await db.wishlists.findOne((w) => w.userId === userId);
  return list?.productIds ?? [];
}

export async function getWishlistProducts(userId: Id): Promise<ProductSummary[]> {
  return getProductSummaries(await getWishlistIds(userId));
}

export async function toggleWishlist(userId: Id, productId: Id): Promise<{ inWishlist: boolean; count: number }> {
  return db.transaction(async () => {
    const list = await db.wishlists.findOne((w) => w.userId === userId);
    const ids = list?.productIds ?? [];
    const has = ids.includes(productId);
    let next: Id[];
    if (has) {
      next = ids.filter((id) => id !== productId);
    } else {
      const product = await db.products.get(productId);
      if (!product || product.status !== "active") throw new DomainError("product_unavailable", { status: 404 });
      if (ids.length >= MAX_ITEMS) throw new DomainError("quantity_invalid", { status: 409 });
      next = [productId, ...ids];
    }
    await persist(userId, list?.id, next);
    return { inWishlist: !has, count: next.length };
  });
}

export async function removeFromWishlist(userId: Id, productId: Id): Promise<void> {
  await db.transaction(async () => {
    const list = await db.wishlists.findOne((w) => w.userId === userId);
    if (!list || !list.productIds.includes(productId)) return;
    await persist(userId, list.id, list.productIds.filter((id) => id !== productId));
  });
}

export async function clearWishlist(userId: Id): Promise<void> {
  await db.transaction(async () => {
    const list = await db.wishlists.findOne((w) => w.userId === userId);
    if (list) await persist(userId, list.id, []);
  });
}

async function persist(userId: Id, existingId: Id | undefined, productIds: Id[]) {
  if (existingId) await db.wishlists.update(existingId, { productIds, updatedAt: nowIso() });
  else await db.wishlists.insert({ userId, productIds, updatedAt: nowIso() });
}

"use server";

import { adjustStock, setStock } from "@/lib/services/inventory";
import { adminAction, refresh } from "./_shared";
import { adjustStockSchema, setStockSchema } from "./inventory.schema";

const PATHS = ["/admin/inventory", "/admin/products", "/admin"];

/** Signed stock change (restock, damage, returns ...). Throws insufficient_stock if it would dip below reserved units. */
export async function adjustStockAction(raw: unknown) {
  return adminAction("inventory.write", adjustStockSchema, raw, async ({ variantId, delta, reason, note, reference }, { actor }) => {
    const movement = await adjustStock({ variantId, delta, reason, ...(note ? { note } : {}), ...(reference ? { reference } : {}) }, actor);
    refresh(PATHS, { store: true });
    return { onHandAfter: movement.onHandAfter };
  });
}

/** Stock count: sets the absolute on-hand quantity (recorded as a correction). */
export async function setStockAction(raw: unknown) {
  return adminAction("inventory.write", setStockSchema, raw, async ({ variantId, onHand, note }, { actor }) => {
    const movement = await setStock(variantId, onHand, note || undefined, actor);
    refresh(PATHS, { store: true });
    return { onHandAfter: movement.onHandAfter };
  });
}

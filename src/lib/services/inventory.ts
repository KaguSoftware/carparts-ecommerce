import "server-only";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import type { Actor, InventoryMovement, InventoryReason, Id, LocalizedString, Paged, PageParams, ProductVariant, StockStatus } from "@/lib/types/domain";
import type { InventoryFilter } from "./contracts";
import { logAudit } from "./audit";
import { nowIso, paginate } from "./_shared";
import { fold } from "./_text";
import { getSettings } from "./settings";
import { releaseCouponRedemption } from "./coupons";
import { logger } from "@/lib/logger";

/**
 * Stock model: `stockOnHand` = physical units (including reserved); `stockReserved` = held by unpaid checkouts.
 * available = onHand - reserved (never < 0). Every change writes an InventoryMovement.
 * reserve / release / commit / restock are meant to run inside the caller's transaction (they join the ambient one).
 */

const SYSTEM: Actor = { id: "system", role: "system" };

export function getStockStatus(available: number, lowStockThreshold: number): StockStatus {
  if (available <= 0) return "out_of_stock";
  if (available <= lowStockThreshold) return "low_stock";
  return "in_stock";
}

export const availableOf = (v: Pick<ProductVariant, "stockOnHand" | "stockReserved">): number => Math.max(0, v.stockOnHand - v.stockReserved);

export async function getAvailability(variantIds: Id[]): Promise<Record<Id, { available: number; status: StockStatus }>> {
  const variants = await db.variants.getMany([...new Set(variantIds)]);
  const out: Record<Id, { available: number; status: StockStatus }> = {};
  for (const v of variants) {
    const available = availableOf(v);
    out[v.id] = { available, status: getStockStatus(available, v.lowStockThreshold) };
  }
  return out;
}

async function recordMovement(
  variant: ProductVariant,
  m: { delta: number; reservedDelta: number; reason: InventoryReason; reference?: string; note?: string; actor: Actor },
): Promise<InventoryMovement> {
  return db.inventoryMovements.insert({
    variantId: variant.id,
    productId: variant.productId,
    delta: m.delta,
    reservedDelta: m.reservedDelta,
    reason: m.reason,
    ...(m.reference ? { reference: m.reference } : {}),
    ...(m.note ? { note: m.note.slice(0, 500) } : {}),
    actor: m.actor,
    onHandAfter: variant.stockOnHand,
    reservedAfter: variant.stockReserved,
    createdAt: nowIso(),
  });
}

/** Writes an `initial` movement for a brand new variant (catalog service). */
export async function recordInitialStock(variant: ProductVariant, actor: Actor): Promise<void> {
  if (variant.stockOnHand > 0) {
    await recordMovement(variant, { delta: variant.stockOnHand, reservedDelta: 0, reason: "initial", note: "Initial stock", actor });
  }
}

function mergeItems(items: { variantId: Id; quantity: number }[]): Map<Id, number> {
  const map = new Map<Id, number>();
  for (const it of items) {
    if (!Number.isInteger(it.quantity) || it.quantity <= 0) throw new DomainError("quantity_invalid");
    map.set(it.variantId, (map.get(it.variantId) ?? 0) + it.quantity);
  }
  return map;
}

export async function adjustStock(
  input: { variantId: Id; delta: number; reason: Extract<InventoryReason, "adjustment" | "purchase" | "damage" | "correction" | "return">; note?: string; reference?: string },
  actor: Actor,
): Promise<InventoryMovement> {
  if (!Number.isInteger(input.delta) || input.delta === 0 || Math.abs(input.delta) > 1_000_000) {
    throw new DomainError("validation_failed", { fieldErrors: { delta: ["integer_required"] } });
  }
  return db.transaction(async () => {
    const variant = await db.variants.get(input.variantId);
    if (!variant) throw new DomainError("not_found", { status: 404, params: { what: "variant" } });
    const next = variant.stockOnHand + input.delta;
    if (next < variant.stockReserved) {
      throw new DomainError("insufficient_stock", { status: 409, params: { available: availableOf(variant) } });
    }
    const updated = await db.variants.update(variant.id, { stockOnHand: next, updatedAt: nowIso() });
    const movement = await recordMovement(updated, { delta: input.delta, reservedDelta: 0, reason: input.reason, reference: input.reference, note: input.note, actor });
    await logAudit({
      actor,
      action: "inventory.adjust",
      entityType: "variant",
      entityId: variant.id,
      summary: `${variant.sku}: ${input.delta > 0 ? "+" : ""}${input.delta} (${input.reason})`,
      changes: { stockOnHand: { from: variant.stockOnHand, to: next } },
    });
    return movement;
  });
}

export async function setStock(variantId: Id, onHand: number, note: string | undefined, actor: Actor): Promise<InventoryMovement> {
  if (!Number.isInteger(onHand) || onHand < 0 || onHand > 10_000_000) {
    throw new DomainError("validation_failed", { fieldErrors: { onHand: ["must_not_be_negative"] } });
  }
  return db.transaction(async () => {
    const variant = await db.variants.get(variantId);
    if (!variant) throw new DomainError("not_found", { status: 404, params: { what: "variant" } });
    if (onHand < variant.stockReserved) {
      throw new DomainError("insufficient_stock", { status: 409, params: { available: availableOf(variant) } });
    }
    const delta = onHand - variant.stockOnHand;
    const updated = await db.variants.update(variantId, { stockOnHand: onHand, updatedAt: nowIso() });
    const movement = await recordMovement(updated, { delta, reservedDelta: 0, reason: "correction", note: note ?? "Stock count", actor });
    await logAudit({
      actor,
      action: "inventory.set",
      entityType: "variant",
      entityId: variantId,
      summary: `${variant.sku}: stock set to ${onHand}`,
      changes: { stockOnHand: { from: variant.stockOnHand, to: onHand } },
    });
    return movement;
  });
}

export async function listMovements(
  filter: InventoryFilter,
): Promise<Paged<InventoryMovement & { sku: string; productName: LocalizedString }>> {
  const from = filter.from ? Date.parse(filter.from) : undefined;
  const to = filter.to ? Date.parse(filter.to) : undefined;
  const rows = await db.inventoryMovements.find({
    where: (m) => {
      if (filter.variantId && m.variantId !== filter.variantId) return false;
      if (filter.productId && m.productId !== filter.productId) return false;
      if (filter.reason && m.reason !== filter.reason) return false;
      if (from !== undefined || to !== undefined) {
        const t = Date.parse(m.createdAt);
        if (from !== undefined && t < from) return false;
        if (to !== undefined && t > to) return false;
      }
      return true;
    },
    orderBy: [
      { field: "createdAt", direction: "desc" },
      { field: "id", direction: "desc" },
    ],
  });
  const page = paginate(rows, filter, 50);
  const [variants, products] = await Promise.all([
    db.variants.getMany([...new Set(page.items.map((m) => m.variantId))]),
    db.products.getMany([...new Set(page.items.map((m) => m.productId))]),
  ]);
  const vMap = new Map(variants.map((v) => [v.id, v]));
  const pMap = new Map(products.map((p) => [p.id, p]));
  return {
    ...page,
    items: page.items.map((m) => ({
      ...m,
      sku: vMap.get(m.variantId)?.sku ?? "(deleted)",
      productName: pMap.get(m.productId)?.name ?? { en: "(deleted)", tr: "(silindi)" },
    })),
  };
}

export async function listLowStock(opts: { limit?: number; includeOutOfStock?: boolean } = {}) {
  const includeOut = opts.includeOutOfStock ?? true;
  const [variants, products] = await Promise.all([db.variants.find({ where: (v) => v.isActive }), db.products.all()]);
  const pMap = new Map(products.filter((p) => p.status !== "archived").map((p) => [p.id, p]));
  const rows = variants
    .map((v) => ({ v, p: pMap.get(v.productId), available: availableOf(v) }))
    .filter((r) => r.p && r.available <= r.v.lowStockThreshold && (includeOut || r.available > 0))
    .sort((a, b) => a.available - b.available || a.v.sku.localeCompare(b.v.sku))
    .map((r) => ({
      variantId: r.v.id,
      productId: r.v.productId,
      sku: r.v.sku,
      productName: (r.p as NonNullable<typeof r.p>).name,
      variantName: r.v.name,
      available: r.available,
      onHand: r.v.stockOnHand,
      threshold: r.v.lowStockThreshold,
    }));
  return opts.limit ? rows.slice(0, Math.max(0, opts.limit)) : rows;
}

/* ------------------------------------------------------------------ checkout primitives (run in the caller's tx) */

export async function reserveStock(items: { variantId: Id; quantity: number }[], reference: string): Promise<void> {
  const merged = mergeItems(items);
  await db.transaction(async () => {
    for (const [variantId, quantity] of merged) {
      const variant = await db.variants.get(variantId);
      if (!variant || !variant.isActive) throw new DomainError("variant_unavailable", { status: 409 });
      const available = availableOf(variant);
      if (available <= 0) throw new DomainError("out_of_stock", { status: 409, params: { available: 0 } });
      if (available < quantity) throw new DomainError("insufficient_stock", { status: 409, params: { available } });
      const updated = await db.variants.update(variantId, { stockReserved: variant.stockReserved + quantity, updatedAt: nowIso() });
      await recordMovement(updated, { delta: 0, reservedDelta: quantity, reason: "reservation", reference, note: "Held for checkout", actor: SYSTEM });
    }
  });
}

export async function releaseStock(items: { variantId: Id; quantity: number }[], reference: string): Promise<void> {
  const merged = mergeItems(items);
  await db.transaction(async () => {
    for (const [variantId, quantity] of merged) {
      const variant = await db.variants.get(variantId);
      if (!variant) continue;
      const release = Math.min(quantity, variant.stockReserved);
      if (release <= 0) continue;
      const updated = await db.variants.update(variantId, { stockReserved: variant.stockReserved - release, updatedAt: nowIso() });
      await recordMovement(updated, { delta: 0, reservedDelta: -release, reason: "release", reference, note: "Reservation released", actor: SYSTEM });
    }
  });
}

/** reserved -> sold: on-hand decreases, reservation is consumed. */
export async function commitStock(items: { variantId: Id; quantity: number }[], reference: string): Promise<void> {
  const merged = mergeItems(items);
  await db.transaction(async () => {
    for (const [variantId, quantity] of merged) {
      const variant = await db.variants.get(variantId);
      if (!variant) continue;
      const fromReserved = Math.min(quantity, variant.stockReserved);
      if (variant.stockOnHand < quantity) {
        // Defensive: stock was adjusted down by staff while the order was in flight.
        logger.warn("inventory.commit_short", { variantId, reference, onHand: variant.stockOnHand, quantity });
      }
      const sold = Math.min(quantity, variant.stockOnHand);
      const updated = await db.variants.update(variantId, {
        stockOnHand: variant.stockOnHand - sold,
        stockReserved: variant.stockReserved - fromReserved,
        updatedAt: nowIso(),
      });
      await recordMovement(updated, { delta: -sold, reservedDelta: -fromReserved, reason: "sale", reference, actor: SYSTEM });
    }
  });
}

export async function restockItems(items: { variantId: Id; quantity: number }[], reference: string, actor: Actor): Promise<void> {
  const merged = mergeItems(items);
  await db.transaction(async () => {
    for (const [variantId, quantity] of merged) {
      const variant = await db.variants.get(variantId);
      if (!variant) continue; // variant deleted since the order: nothing to restock
      const updated = await db.variants.update(variantId, { stockOnHand: variant.stockOnHand + quantity, updatedAt: nowIso() });
      await recordMovement(updated, { delta: quantity, reservedDelta: 0, reason: "return", reference, note: "Returned to stock", actor });
    }
  });
}

/**
 * Orders still `pending_payment` after `reservationMinutes`:
 *  - unpaid + holding a reservation -> reservation released, order cancelled
 *  - failed (stock already released)  -> order cancelled
 */
export async function releaseExpiredReservations(): Promise<number> {
  const settings = await getSettings();
  // The hold starts at the last (re)reservation: prepareOrder bumps updatedAt on both the new-order and
  // retry paths, so a retried order gets a fresh window. Orders touched in the last 60s are in flight.
  const IN_FLIGHT_MS = 60_000;
  const now = Date.now();
  const cutoff = Math.min(now - settings.checkout.reservationMinutes * 60_000, now - IN_FLIGHT_MS);
  const isExpired = (o: { updatedAt: string }) => Date.parse(o.updatedAt) < cutoff;
  const candidates = await db.orders.find({
    where: (o) => o.status === "pending_payment" && isExpired(o) && (o.paymentStatus === "unpaid" || o.paymentStatus === "failed"),
    limit: 200,
  });
  if (candidates.length === 0) return 0;

  let released = 0;
  for (const candidate of candidates) {
    await db.transaction(async () => {
      const order = await db.orders.get(candidate.id);
      if (!order || order.status !== "pending_payment" || (order.paymentStatus !== "unpaid" && order.paymentStatus !== "failed") || !isExpired(order)) return;
      if (order.paymentStatus === "unpaid") {
        await releaseStock(
          order.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
          order.number,
        );
      }
      const at = nowIso();
      await db.orders.update(order.id, {
        status: "cancelled",
        updatedAt: at,
        events: [
          ...order.events,
          { id: `evt_${order.id}_${order.events.length + 1}`, at, type: "cancelled", status: "cancelled", message: "Payment window expired", actor: SYSTEM },
        ],
      });
      const payment = order.paymentId ? await db.payments.get(order.paymentId) : null;
      if (payment && payment.status !== "succeeded") await db.payments.update(payment.id, { status: "cancelled", updatedAt: at });
      await releaseCouponRedemption(order.id);
      released++;
    });
  }
  if (released > 0) logger.info("inventory.reservations_expired", { count: released });
  return released;
}

/* ------------------------------------------------------------------ admin stock list (additive, used by the admin panel) */

export interface VariantStockRow {
  variantId: Id;
  productId: Id;
  sku: string;
  productName: LocalizedString;
  variantName: LocalizedString;
  brandName: string;
  onHand: number;
  reserved: number;
  available: number;
  threshold: number;
  isActive: boolean;
  status: StockStatus;
}

/** Paged stock overview: one row per variant of every non-archived product, filterable by text and stock status. */
export async function listVariantStock(
  filter: PageParams & { q?: string; status?: StockStatus | "all"; sort?: "sku" | "stock_asc" | "stock_desc" } = {},
): Promise<Paged<VariantStockRow>> {
  const [variants, products, brands] = await Promise.all([db.variants.all(), db.products.all(), db.brands.all()]);
  const pMap = new Map(products.filter((p) => p.status !== "archived").map((p) => [p.id, p]));
  const bMap = new Map(brands.map((b) => [b.id, b.name]));
  const q = filter.q ? fold(filter.q) : "";
  const rows: VariantStockRow[] = [];
  for (const v of variants) {
    const p = pMap.get(v.productId);
    if (!p) continue;
    const available = availableOf(v);
    const status = getStockStatus(available, v.lowStockThreshold);
    if (filter.status && filter.status !== "all" && status !== filter.status) continue;
    if (q && !fold(`${p.name.en} ${p.name.tr} ${v.sku} ${v.name.en} ${v.name.tr} ${p.partNumber} ${bMap.get(p.brandId) ?? ""}`).includes(q)) continue;
    rows.push({
      variantId: v.id,
      productId: v.productId,
      sku: v.sku,
      productName: p.name,
      variantName: v.name,
      brandName: bMap.get(p.brandId) ?? "",
      onHand: v.stockOnHand,
      reserved: v.stockReserved,
      available,
      threshold: v.lowStockThreshold,
      isActive: v.isActive,
      status,
    });
  }
  const sort = filter.sort ?? "sku";
  rows.sort((a, b) => (sort === "stock_asc" ? a.available - b.available : sort === "stock_desc" ? b.available - a.available : 0) || a.sku.localeCompare(b.sku));
  return paginate(rows, filter, 25);
}

import { freshSeed, STAFF } from "../helpers/test-env";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import * as inventory from "@/lib/services/inventory";
import type { ProductVariant } from "@/lib/types/domain";

beforeAll(async () => {
  await freshSeed();
}, 60_000);

let spare = 0;
async function variant(minAvailable = 10): Promise<ProductVariant> {
  const rows = await db.variants.find({ where: (v) => v.isActive && v.stockOnHand - v.stockReserved >= minAvailable });
  return rows[spare++]!;
}
const live = async (id: string) => (await db.variants.get(id))!;

describe("stock status", () => {
  it("derives out / low / in stock from availability and threshold", () => {
    expect(inventory.getStockStatus(0, 5)).toBe("out_of_stock");
    expect(inventory.getStockStatus(-3, 5)).toBe("out_of_stock");
    expect(inventory.getStockStatus(1, 5)).toBe("low_stock");
    expect(inventory.getStockStatus(5, 5)).toBe("low_stock");
    expect(inventory.getStockStatus(6, 5)).toBe("in_stock");
  });

  it("reports availability net of reservations for many variants", async () => {
    const v = await variant();
    await inventory.reserveStock([{ variantId: v.id, quantity: 3 }], "AVAIL");
    const map = await inventory.getAvailability([v.id, v.id, "var_missing"]);
    expect(Object.keys(map)).toEqual([v.id]);
    expect(map[v.id]!.available).toBe(v.stockOnHand - v.stockReserved - 3);
    await inventory.releaseStock([{ variantId: v.id, quantity: 3 }], "AVAIL");
  });
});

describe("manual adjustments", () => {
  it("adjusts stock, writes a movement and an audit entry", async () => {
    const v = await variant();
    const movement = await inventory.adjustStock({ variantId: v.id, delta: 7, reason: "purchase", reference: "PO-1", note: "Supplier delivery" }, STAFF);
    expect(movement).toMatchObject({ variantId: v.id, delta: 7, reservedDelta: 0, reason: "purchase", reference: "PO-1", onHandAfter: v.stockOnHand + 7, actor: { id: STAFF.id } });
    expect((await live(v.id)).stockOnHand).toBe(v.stockOnHand + 7);
    await inventory.adjustStock({ variantId: v.id, delta: -2, reason: "damage" }, STAFF);
    expect((await live(v.id)).stockOnHand).toBe(v.stockOnHand + 5);
    const audit = await db.auditLog.find({ where: (a) => a.entityId === v.id && a.action === "inventory.adjust" });
    expect(audit).toHaveLength(2);
  });

  it("refuses changes that would drop on-hand below reserved, zero deltas and unknown variants", async () => {
    const v = await variant();
    await inventory.reserveStock([{ variantId: v.id, quantity: 4 }], "HOLD");
    const current = await live(v.id);
    await expect(inventory.adjustStock({ variantId: v.id, delta: -(current.stockOnHand - current.stockReserved + 1), reason: "correction" }, STAFF)).rejects.toMatchObject({ code: "insufficient_stock" });
    await expect(inventory.setStock(v.id, current.stockReserved - 1, undefined, STAFF)).rejects.toMatchObject({ code: "insufficient_stock" });
    await expect(inventory.adjustStock({ variantId: v.id, delta: 0, reason: "correction" }, STAFF)).rejects.toMatchObject({ code: "validation_failed" });
    await expect(inventory.adjustStock({ variantId: v.id, delta: 1.5, reason: "correction" }, STAFF)).rejects.toMatchObject({ code: "validation_failed" });
    await expect(inventory.adjustStock({ variantId: "var_missing", delta: 1, reason: "correction" }, STAFF)).rejects.toMatchObject({ code: "not_found" });
    await expect(inventory.setStock(v.id, -1, undefined, STAFF)).rejects.toMatchObject({ code: "validation_failed" });
    await inventory.releaseStock([{ variantId: v.id, quantity: 4 }], "HOLD");
  });

  it("setStock records the difference as a correction", async () => {
    const v = await variant();
    const m = await inventory.setStock(v.id, v.stockReserved + 42, "Cycle count", STAFF);
    expect(m).toMatchObject({ reason: "correction", delta: v.stockReserved + 42 - v.stockOnHand, note: "Cycle count" });
    expect((await live(v.id)).stockOnHand).toBe(v.stockReserved + 42);
  });
});

describe("reserve / release / commit / restock", () => {
  it("reserves, merges duplicate lines, and commits reserved stock into a sale", async () => {
    const v = await variant();
    const before = await live(v.id);
    await inventory.reserveStock(
      [
        { variantId: v.id, quantity: 2 },
        { variantId: v.id, quantity: 1 },
      ],
      "AX-T1",
    );
    const held = await live(v.id);
    expect(held.stockReserved).toBe(before.stockReserved + 3);
    expect(held.stockOnHand).toBe(before.stockOnHand);

    await inventory.commitStock([{ variantId: v.id, quantity: 3 }], "AX-T1");
    const sold = await live(v.id);
    expect(sold.stockOnHand).toBe(before.stockOnHand - 3);
    expect(sold.stockReserved).toBe(before.stockReserved);

    await inventory.restockItems([{ variantId: v.id, quantity: 1 }], "AX-T1", STAFF);
    expect((await live(v.id)).stockOnHand).toBe(before.stockOnHand - 2);

    const ledger = await db.inventoryMovements.find({ where: (m) => m.reference === "AX-T1", orderBy: [{ field: "createdAt", direction: "asc" }] });
    expect(ledger.map((m) => m.reason)).toEqual(["reservation", "sale", "return"]);
    expect(ledger[1]).toMatchObject({ delta: -3, reservedDelta: -3 });
  });

  it("is all-or-nothing: a shortfall on any line rolls back every reservation", async () => {
    const a = await variant();
    const b = await variant();
    const beforeA = await live(a.id);
    const beforeB = await live(b.id);
    await expect(
      inventory.reserveStock(
        [
          { variantId: a.id, quantity: 2 },
          { variantId: b.id, quantity: beforeB.stockOnHand - beforeB.stockReserved + 1 },
        ],
        "AX-T2",
      ),
    ).rejects.toMatchObject({ code: "insufficient_stock" });
    expect((await live(a.id)).stockReserved).toBe(beforeA.stockReserved);
    expect(await db.inventoryMovements.count((m) => m.reference === "AX-T2")).toBe(0);
  });

  it("reports out_of_stock, unavailable variants and invalid quantities", async () => {
    const v = await variant();
    await inventory.setStock(v.id, (await live(v.id)).stockReserved, undefined, STAFF);
    await expect(inventory.reserveStock([{ variantId: v.id, quantity: 1 }], "X")).rejects.toMatchObject({ code: "out_of_stock" });
    await expect(inventory.reserveStock([{ variantId: "var_missing", quantity: 1 }], "X")).rejects.toMatchObject({ code: "variant_unavailable" });
    await expect(inventory.reserveStock([{ variantId: v.id, quantity: 0 }], "X")).rejects.toMatchObject({ code: "quantity_invalid" });
    await expect(inventory.reserveStock([{ variantId: v.id, quantity: -2 }], "X")).rejects.toMatchObject({ code: "quantity_invalid" });
  });

  it("release never drops the reservation below zero", async () => {
    const v = await variant();
    const before = await live(v.id);
    await inventory.releaseStock([{ variantId: v.id, quantity: 999 }], "AX-T3");
    expect((await live(v.id)).stockReserved).toBe(Math.max(0, before.stockReserved - 999));
  });
});

describe("history and low stock", () => {
  it("filters, sorts and paginates the movement ledger with names attached", async () => {
    const v = await variant();
    await inventory.adjustStock({ variantId: v.id, delta: 1, reason: "adjustment" }, STAFF);
    const page = await inventory.listMovements({ variantId: v.id, pageSize: 2 });
    expect(page.items.length).toBeLessThanOrEqual(2);
    expect(page.items[0]).toMatchObject({ variantId: v.id, sku: v.sku });
    expect(page.items[0]!.productName.en.length).toBeGreaterThan(0);
    const dates = page.items.map((m) => m.createdAt);
    expect(dates).toEqual([...dates].sort().reverse());
    const sales = await inventory.listMovements({ reason: "sale", pageSize: 100 });
    expect(sales.items.every((m) => m.reason === "sale")).toBe(true);
    expect((await inventory.listMovements({ from: new Date(Date.now() + 3_600_000).toISOString() })).total).toBe(0);
  });

  it("lists low and out-of-stock variants, worst first", async () => {
    const v = await variant();
    await inventory.setStock(v.id, (await live(v.id)).stockReserved + 1, undefined, STAFF);
    const low = await inventory.listLowStock();
    expect(low.some((l) => l.variantId === v.id)).toBe(true);
    const avail = low.map((l) => l.available);
    expect(avail).toEqual([...avail].sort((a, b) => a - b));
    const withoutOut = await inventory.listLowStock({ includeOutOfStock: false });
    expect(withoutOut.every((l) => l.available > 0)).toBe(true);
    expect((await inventory.listLowStock({ limit: 3 })).length).toBe(3);
  });
});

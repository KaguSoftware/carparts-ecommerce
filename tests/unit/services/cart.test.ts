import { CUSTOMER_ID, freshSeed, STAFF } from "../helpers/test-env";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import * as cart from "@/lib/services/cart";
import * as catalog from "@/lib/services/catalog";
import * as inventory from "@/lib/services/inventory";
import type { ProductVariant } from "@/lib/types/domain";

/** An active variant with plenty of stock and a plain price. */
async function pickVariant(opts: { minStock?: number; skip?: number } = {}): Promise<ProductVariant> {
  const products = await db.products.find({ where: (p) => p.status === "active" });
  const active = new Set(products.map((p) => p.id));
  const variants = await db.variants.find({ where: (v) => v.isActive && active.has(v.productId) && v.stockOnHand - v.stockReserved >= (opts.minStock ?? 12) });
  return variants[opts.skip ?? 0]!;
}

beforeAll(async () => {
  await freshSeed();
}, 60_000);

let cartId: string;
beforeEach(async () => {
  cartId = (await cart.getOrCreateCart({})).id;
});

describe("cart basics", () => {
  it("creates empty guest carts and adds, increments and removes lines with server-side prices", async () => {
    const v = await pickVariant();
    const view = await cart.addItem(cartId, v.id, 2);
    expect(view.lines).toHaveLength(1);
    expect(view.lines[0]).toMatchObject({ variantId: v.id, quantity: 2, unitPrice: v.price, lineTotal: v.price * 2 });
    expect(view.totals).toMatchObject({ subtotal: v.price * 2, discount: 0, itemCount: 2, total: v.price * 2 });

    const again = await cart.addItem(cartId, v.id, 3);
    expect(again.lines[0]?.quantity).toBe(5);
    expect(await cart.getCartItemCount(cartId)).toBe(5);

    const set = await cart.setItemQuantity(cartId, v.id, 1);
    expect(set.lines[0]?.quantity).toBe(1);
    const removed = await cart.setItemQuantity(cartId, v.id, 0);
    expect(removed.lines).toHaveLength(0);

    await cart.addItem(cartId, v.id, 1);
    expect((await cart.removeItem(cartId, v.id)).lines).toHaveLength(0);
    await cart.addItem(cartId, v.id, 1);
    expect((await cart.clearCart(cartId)).totals.itemCount).toBe(0);
  });

  it("validates quantity, stock, availability and the per-line cap", async () => {
    const v = await pickVariant();
    await expect(cart.addItem(cartId, v.id, 0)).rejects.toMatchObject({ code: "quantity_invalid" });
    await expect(cart.addItem(cartId, v.id, 1.5)).rejects.toMatchObject({ code: "quantity_invalid" });
    await expect(cart.addItem(cartId, v.id, 11)).rejects.toMatchObject({ code: "quantity_invalid" }); // cap is 10 per line
    await expect(cart.addItem(cartId, "var_missing", 1)).rejects.toMatchObject({ code: "variant_unavailable" });
    await expect(cart.addItem("crt_missing", v.id, 1)).rejects.toMatchObject({ code: "cart_not_found" });

    const scarce = await pickVariant({ minStock: 4 });
    await inventory.setStock(scarce.id, scarce.stockReserved + 3, "test", STAFF);
    await expect(cart.addItem(cartId, scarce.id, 4)).rejects.toMatchObject({ code: "insufficient_stock", params: { available: 3 } });
    await cart.addItem(cartId, scarce.id, 3);
    await expect(cart.addItem(cartId, scarce.id, 1)).rejects.toMatchObject({ code: "insufficient_stock" });

    await inventory.setStock(scarce.id, scarce.stockReserved, "test", STAFF);
    await expect(cart.addItem(cartId, scarce.id, 1)).rejects.toMatchObject({ code: "out_of_stock" });
    // the line already in the cart is kept (stock may come back) but flagged with a warning
    const view = await cart.getCartView(cartId);
    expect(view!.lines.find((l) => l.variantId === scarce.id)).toMatchObject({ available: 0, maxQuantity: 0 });
    expect(view!.warnings).toContainEqual({ type: "item_removed", variantId: scarce.id, reason: "out_of_stock" });
    await inventory.setStock(scarce.id, scarce.stockReserved + 20, "test", STAFF);
  });

  it("re-prices from the catalog (never trusts what was stored) and warns on price changes", async () => {
    const v = await pickVariant({ skip: 3 });
    await cart.addItem(cartId, v.id, 2);
    await catalog.updateVariant(v.id, { price: v.price + 500, compareAtPrice: undefined }, STAFF);
    const view = await cart.getCartView(cartId);
    expect(view!.lines[0]?.unitPrice).toBe(v.price + 500);
    expect(view!.totals.subtotal).toBe((v.price + 500) * 2);
    expect(view!.warnings).toContainEqual({ type: "price_changed", variantId: v.id, from: v.price, to: v.price + 500 });
    await catalog.updateVariant(v.id, { price: v.price }, STAFF);
  });

  it("clamps quantities when stock drops below what is in the cart", async () => {
    const v = await pickVariant({ skip: 4 });
    await cart.addItem(cartId, v.id, 6);
    await inventory.setStock(v.id, v.stockReserved + 4, "test", STAFF);
    const view = await cart.getCartView(cartId);
    expect(view!.lines[0]?.quantity).toBe(4);
    expect(view!.warnings.some((w) => w.type === "quantity_reduced" && w.variantId === v.id)).toBe(true);
    // stock-driven clamping is view-only: other shoppers' temporary holds never rewrite the stored cart
    expect((await db.carts.get(cartId))!.items[0]?.quantity).toBe(6);
    await inventory.setStock(v.id, v.stockReserved + 20, "test", STAFF);
  });

  it("drops lines whose product was deactivated or archived", async () => {
    const v = await pickVariant({ skip: 5 });
    await cart.addItem(cartId, v.id, 1);
    await catalog.setProductStatus(v.productId, "archived", STAFF);
    const view = await cart.getCartView(cartId);
    expect(view!.lines).toHaveLength(0);
    expect(view!.warnings).toContainEqual({ type: "item_removed", variantId: v.id, reason: "unavailable" });
    await catalog.setProductStatus(v.productId, "active", STAFF);
    await expect(cart.addItem(cartId, v.id, 1)).resolves.toBeTruthy();
  });

  it("computes free-shipping progress from the threshold", async () => {
    const cheap = (await db.variants.find({ where: (v) => v.isActive && v.price < 3000 && v.stockOnHand - v.stockReserved > 5 }))[0]!;
    const view = await cart.addItem(cartId, cheap.id, 1);
    expect(view.totals.freeShippingRemaining).toBe(9900 - cheap.price);
  });
});

describe("cart coupons", () => {
  it("applies and removes a coupon, recomputing the discount on the server", async () => {
    const v = await pickVariant({ skip: 6 });
    await cart.addItem(cartId, v.id, 1);
    const withCoupon = await cart.applyCoupon(cartId, " welcome10 ");
    expect(withCoupon.coupon).toMatchObject({ code: "WELCOME10", type: "percent" });
    expect(withCoupon.totals.discount).toBe(Math.round(v.price * 0.1));
    expect(withCoupon.totals.total).toBe(v.price - withCoupon.totals.discount);
    const without = await cart.removeCoupon(cartId);
    expect(without.coupon).toBeUndefined();
    expect(without.totals.discount).toBe(0);
  });

  it("rejects unknown coupons, empty carts and drops a coupon that stops being valid", async () => {
    await expect(cart.applyCoupon(cartId, "WELCOME10")).rejects.toMatchObject({ code: "cart_empty" });
    const v = await pickVariant({ skip: 7 });
    await cart.addItem(cartId, v.id, 1);
    await expect(cart.applyCoupon(cartId, "NOPE")).rejects.toMatchObject({ code: "coupon_invalid" });
    await expect(cart.applyCoupon(cartId, "SPRING20")).rejects.toMatchObject({ code: "coupon_expired" });
    await expect(cart.applyCoupon(cartId, "BLACKFRIDAY")).rejects.toMatchObject({ code: "coupon_not_started" });

    await cart.applyCoupon(cartId, "WELCOME10");
    const coupon = (await db.coupons.findOne((c) => c.code === "WELCOME10"))!;
    await db.coupons.update(coupon.id, { isActive: false });
    const view = await cart.getCartView(cartId);
    expect(view!.coupon).toBeUndefined();
    expect(view!.warnings).toContainEqual({ type: "coupon_removed", code: "WELCOME10", reason: "coupon_invalid" });
    await db.coupons.update(coupon.id, { isActive: true });
  });
});

describe("guest cart ownership and merge on login", () => {
  it("a guest cookie can never open a signed-in user's cart", async () => {
    const userCart = await cart.getOrCreateCart({ userId: CUSTOMER_ID });
    const stranger = await cart.getOrCreateCart({ cartId: userCart.id });
    expect(stranger.id).not.toBe(userCart.id);
    expect(stranger.userId).toBeNull();
    const again = await cart.getOrCreateCart({ userId: CUSTOMER_ID });
    expect(again.id).toBe(userCart.id);
  });

  it("merges guest lines into the user's cart, summing quantities within stock", async () => {
    const a = await pickVariant({ skip: 8 });
    const b = await pickVariant({ skip: 9 });
    const userCart = await cart.getOrCreateCart({ userId: "usr_c01" });
    await cart.addItem(userCart.id, a.id, 2);

    const guest = await cart.getOrCreateCart({});
    await cart.addItem(guest.id, a.id, 3);
    await cart.addItem(guest.id, b.id, 1);
    await inventory.setStock(a.id, a.stockReserved + 4, "test", STAFF); // only 4 available: the merged 5 must be capped

    const merged = await cart.mergeGuestCart(guest.id, "usr_c01");
    expect(merged.id).toBe(userCart.id);
    expect(merged.items.find((i) => i.variantId === a.id)?.quantity).toBe(4);
    expect(merged.items.find((i) => i.variantId === b.id)?.quantity).toBe(1);
    expect(await db.carts.get(guest.id)).toBeNull();
    await inventory.setStock(a.id, a.stockReserved + 20, "test", STAFF);
  });

  it("adopts the guest cart when the user has none and ignores someone else's cart", async () => {
    const v = await pickVariant({ skip: 10 });
    const guest = await cart.getOrCreateCart({});
    await cart.addItem(guest.id, v.id, 2);
    const adopted = await cart.mergeGuestCart(guest.id, "usr_c02");
    expect(adopted.userId).toBe("usr_c02");
    expect(adopted.items[0]?.quantity).toBe(2);

    const other = await cart.getOrCreateCart({ userId: "usr_c03" });
    await cart.addItem(other.id, v.id, 1);
    const mine = await cart.mergeGuestCart(other.id, "usr_c02"); // a user cart is not a guest cart: untouched
    expect(mine.id).toBe(adopted.id);
    expect((await db.carts.get(other.id))!.items).toHaveLength(1);
  });
});

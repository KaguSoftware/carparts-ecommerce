/**
 * Seed data for the JSON store (and the reference data set for a future DB migration).
 *
 * Everything is derived from code in this folder, relative to one "now", so the demo always looks
 * recent. IDs are deterministic (`prd_001`, `ord_100450`, ...); only dates, access tokens' order
 * and scrypt salts vary between runs.
 *
 * This folder is intentionally free of `server-only` so `scripts/` can import it (art generation).
 */
import type { SeedData } from "../collections";
import { buildBrands } from "./brands";
import { buildCatalog } from "./catalog/build";
import { buildCategories } from "./categories";
import { buildCoupons, buildSettings, buildShippingMethods, buildTaxRates } from "./commerce";
import { buildBanners, buildPages } from "./content";
import { buildContactMessages, buildAudit, buildNewsletter, buildSearchLog } from "./misc";
import { buildOrders } from "./orders";
import { buildPeople } from "./people";
import { applyAggregates, buildReviews } from "./reviews";
import { makeClock, pad } from "./util";
import { buildVehicles } from "./vehicles";

export { SEED_CREDENTIALS } from "./credentials";

export interface BuildSeedOptions {
  /** Reference time; defaults to the current time. */
  now?: Date;
}

export async function buildSeed(options: BuildSeedOptions = {}): Promise<SeedData> {
  const clock = makeClock(options.now);

  const vehicles = buildVehicles();
  const catalog = buildCatalog(clock, vehicles);
  const brands = buildBrands(clock);
  const categories = buildCategories(clock);
  const shippingMethods = buildShippingMethods(clock);
  const taxRates = buildTaxRates(clock);
  const couponSeeds = buildCoupons(clock);

  // Orders consume stock and create ledger movements.
  const orders = buildOrders(clock, catalog, couponSeeds, shippingMethods, taxRates);
  for (const b of catalog.built) {
    for (const v of b.variants) {
      const s = orders.stock.get(v.id);
      if (s) {
        v.stockOnHand = s.onHand;
        v.stockReserved = s.reserved;
      }
    }
  }

  const { reviews, reviewVotes } = buildReviews(clock, catalog.built, orders.purchased);
  applyAggregates(catalog.built, reviews, orders.unitsSold);

  const coupons = couponSeeds.map(({ coupon, historicalUses }) => ({
    ...coupon,
    usedCount: historicalUses + (orders.couponUses.get(coupon.code) ?? 0),
  }));

  const wishlistProducts = catalog.built.filter((b) => b.product.status === "active" && b.product.isFeatured).map((b) => b.product.id);
  const people = await buildPeople(clock, wishlistProducts);

  const inventoryMovements = [...catalog.movements, ...orders.movements]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map((m, i) => ({ ...m, id: `inv_${pad(i + 1, 5)}` }));

  return {
    users: people.users,
    addresses: people.addresses,
    categories,
    brands,
    products: catalog.products,
    variants: catalog.variants,
    vehicleMakes: vehicles.makes,
    vehicleModels: vehicles.models,
    vehicles: vehicles.vehicles,
    fitment: catalog.fitment,
    reviews,
    carts: [],
    orders: orders.orders,
    payments: orders.payments,
    inventoryMovements,
    coupons,
    couponRedemptions: orders.redemptions,
    shippingMethods,
    taxRates,
    wishlists: people.wishlists,
    pages: buildPages(clock),
    banners: buildBanners(clock),
    settings: [buildSettings(clock, orders.nextOrderNumber)],
    newsletter: buildNewsletter(clock),
    contactMessages: buildContactMessages(clock, orders.orders),
    auditLog: buildAudit(clock, catalog.built, orders.orders),
    searchLog: buildSearchLog(clock),
    reviewVotes,
    authAccounts: people.authAccounts,
    authSessions: [],
    authVerifications: [],
    loginAttempts: [],
  };
}

/** Shape expected by the JSON store (`seed()` option). */
export async function buildSeedRows(options?: BuildSeedOptions): Promise<SeedData> {
  return buildSeed(options);
}

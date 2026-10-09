import "server-only";
import type { CollectionMap, CollectionName } from "./contracts";

/**
 * Runtime list of every collection. The type check below fails compilation when `CollectionMap`
 * gains a collection that is not listed here (or vice versa).
 */
export const COLLECTION_NAMES = [
  "users",
  "addresses",
  "categories",
  "brands",
  "products",
  "variants",
  "vehicleMakes",
  "vehicleModels",
  "vehicles",
  "fitment",
  "reviews",
  "carts",
  "orders",
  "payments",
  "inventoryMovements",
  "coupons",
  "couponRedemptions",
  "shippingMethods",
  "taxRates",
  "wishlists",
  "pages",
  "banners",
  "settings",
  "newsletter",
  "contactMessages",
  "auditLog",
  "searchLog",
  "reviewVotes",
  "authAccounts",
  "authSessions",
  "authVerifications",
  "loginAttempts",
] as const satisfies readonly CollectionName[];

type Missing = Exclude<CollectionName, (typeof COLLECTION_NAMES)[number]>;
// Compile-time exhaustiveness check: assigning `never` only works when nothing is missing.
const _exhaustive: [Missing] extends [never] ? true : never = true;
void _exhaustive;

/** Id prefixes (debuggability only). */
export const ID_PREFIX: { readonly [K in CollectionName]: string } = {
  users: "usr",
  addresses: "adr",
  categories: "cat",
  brands: "brd",
  products: "prd",
  variants: "var",
  vehicleMakes: "mak",
  vehicleModels: "mdl",
  vehicles: "veh",
  fitment: "fit",
  reviews: "rev",
  carts: "crt",
  orders: "ord",
  payments: "pay",
  inventoryMovements: "inv",
  coupons: "cpn",
  couponRedemptions: "red",
  shippingMethods: "shp",
  taxRates: "tax",
  wishlists: "wsh",
  pages: "pge",
  banners: "ban",
  settings: "set",
  newsletter: "nws",
  contactMessages: "msg",
  auditLog: "aud",
  searchLog: "sch",
  reviewVotes: "vot",
  authAccounts: "acc",
  authSessions: "ses",
  authVerifications: "ver",
  loginAttempts: "lga",
};

/** Collections that grow quickly and are rewritten often: written without indentation. */
export const COMPACT_COLLECTIONS: readonly CollectionName[] = [
  "fitment",
  "vehicles",
  "auditLog",
  "searchLog",
  "inventoryMovements",
  "authSessions",
  "authVerifications",
  "reviewVotes",
  "loginAttempts",
  "couponRedemptions",
];

export type SeedData = { [K in CollectionName]: CollectionMap[K][] };

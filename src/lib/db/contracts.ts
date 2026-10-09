/**
 * PERSISTENCE CONTRACT. Services depend ONLY on these interfaces (via `getDb()` from src/lib/db).
 * UI, Server Actions and route handlers never touch repositories or JSON files directly.
 *
 * Today: JSON-file implementation (src/lib/db/json/*): in-memory map per collection, atomic write
 * (write temp file + rename), single process-wide mutex for write transactions, first boot copies
 * seed data from src/lib/db/seed into DATA_DIR. Later: swap `getDb()` for a Prisma/Drizzle-backed
 * implementation of the same interfaces. Nothing above this layer changes.
 */
import type { Id } from "@/lib/types/domain";

/** Every persisted collection and its entity type (type-level registry). */
export interface CollectionMap {
  users: import("@/lib/types/domain").User;
  addresses: import("@/lib/types/domain").Address;
  categories: import("@/lib/types/domain").Category;
  brands: import("@/lib/types/domain").Brand;
  products: import("@/lib/types/domain").Product;
  variants: import("@/lib/types/domain").ProductVariant;
  vehicleMakes: import("@/lib/types/domain").VehicleMake;
  vehicleModels: import("@/lib/types/domain").VehicleModel;
  vehicles: import("@/lib/types/domain").Vehicle;
  fitment: import("@/lib/types/domain").FitmentRow;
  reviews: import("@/lib/types/domain").Review;
  carts: import("@/lib/types/domain").Cart;
  orders: import("@/lib/types/domain").Order;
  payments: import("@/lib/types/domain").Payment;
  inventoryMovements: import("@/lib/types/domain").InventoryMovement;
  coupons: import("@/lib/types/domain").Coupon;
  couponRedemptions: { id: Id; couponId: Id; orderId: Id; userId: Id | null; email: string; at: string };
  shippingMethods: import("@/lib/types/domain").ShippingMethod;
  taxRates: import("@/lib/types/domain").TaxRate;
  wishlists: import("@/lib/types/domain").Wishlist;
  pages: import("@/lib/types/domain").CmsPage;
  banners: import("@/lib/types/domain").Banner;
  settings: import("@/lib/types/domain").StoreSettings;
  newsletter: import("@/lib/types/domain").NewsletterSubscriber;
  contactMessages: import("@/lib/types/domain").ContactMessage;
  auditLog: import("@/lib/types/domain").AuditEntry;
  searchLog: { id: Id; q: string; resultCount: number; at: string };
  reviewVotes: { id: Id; reviewId: Id; voterKey: string; at: string };
  /** Better Auth tables, stored through the same adapter: */
  authAccounts: { id: Id; userId: Id; providerId: string; accountId: string; password?: string | null; createdAt: string; updatedAt: string };
  authSessions: { id: Id; userId: Id; token: string; expiresAt: string; ipAddress?: string | null; userAgent?: string | null; createdAt: string; updatedAt: string };
  authVerifications: { id: Id; identifier: string; value: string; expiresAt: string; createdAt: string; updatedAt: string };
  loginAttempts: { id: Id; key: string; failures: number; lockedUntil?: string | null; updatedAt: string };
}

export type CollectionName = keyof CollectionMap;

export interface QueryOptions<T> {
  where?: (row: T) => boolean;
  orderBy?: { field: keyof T & string; direction: "asc" | "desc" }[];
  offset?: number;
  limit?: number;
}

export interface Repository<T extends { id: Id }> {
  get(id: Id): Promise<T | null>;
  getMany(ids: Id[]): Promise<T[]>;
  all(): Promise<T[]>;
  find(options?: QueryOptions<T>): Promise<T[]>;
  findOne(where: (row: T) => boolean): Promise<T | null>;
  count(where?: (row: T) => boolean): Promise<number>;
  /** `id` generated (`createId()`) when omitted. Rejects on duplicate id. */
  insert(row: Omit<T, "id"> & { id?: Id }): Promise<T>;
  /** Shallow merge. Rejects when missing. */
  update(id: Id, patch: Partial<Omit<T, "id">>): Promise<T>;
  /** Insert-or-replace. */
  upsert(row: T): Promise<T>;
  delete(id: Id): Promise<boolean>;
  deleteWhere(where: (row: T) => boolean): Promise<number>;
}

export interface Database {
  repo<K extends CollectionName>(name: K): Repository<CollectionMap[K]>;
  /**
   * Run `fn` as an exclusive write transaction (process-wide mutex): reads inside see the latest
   * committed state and all writes become visible together; if `fn` throws, nothing is persisted.
   * Use it for any read-modify-write that must be atomic (stock reservation, order numbering,
   * coupon redemption, checkout).
   */
  transaction<R>(fn: (tx: Database) => Promise<R>): Promise<R>;
}

/** Entry point: `const db = getDb();` (src/lib/db/index.ts) - lazily seeds on first use. */
export type GetDb = () => Database;

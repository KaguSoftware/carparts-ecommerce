import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { SeedData } from "../collections";
import { SEED_CREDENTIALS } from "./credentials";

export interface ProductionSeedOptions {
  /** Administrator login. Defaults to the demo admin address. */
  adminEmail?: string;
  /** Fixed administrator password (min 12 chars). A random one is generated and printed once when omitted. */
  adminPassword?: string;
}

/**
 * Production first boot: keeps the catalogue / settings / content reference data, but drops every demo person
 * (staff, customers, their orders, reviews, ...) and creates a single administrator whose password is NOT the
 * publicly documented demo one.
 */
export async function toProductionSeed(rows: SeedData, options: ProductionSeedOptions = {}): Promise<SeedData> {
  const generated = !options.adminPassword;
  const password = options.adminPassword ?? randomBytes(18).toString("base64url");
  const email = (options.adminEmail ?? SEED_CREDENTIALS.admin.email).toLowerCase();
  const hash = await hashPassword(password);

  const admin = rows.users.find((u) => u.id === SEED_CREDENTIALS.admin.id);
  const authAdmin = rows.authAccounts.find((a) => a.userId === SEED_CREDENTIALS.admin.id);
  if (!admin || !authAdmin) throw new Error("Seed data is missing the administrator account");

  const now = new Date().toISOString();
  const products = rows.products.map((p) => ({ ...p, ratingAverage: 0, ratingCount: 0, soldCount: 0 }));

  const result: SeedData = {
    ...rows,
    users: [{ ...admin, email, createdAt: now, updatedAt: now, lastLoginAt: null }],
    authAccounts: [{ ...authAdmin, password: hash, createdAt: now, updatedAt: now }],
    authSessions: [],
    authVerifications: [],
    loginAttempts: [],
    addresses: [],
    wishlists: [],
    carts: [],
    orders: [],
    payments: [],
    inventoryMovements: [],
    couponRedemptions: [],
    coupons: rows.coupons.map((c) => ({ ...c, usedCount: 0 })),
    reviews: [],
    reviewVotes: [],
    newsletter: [],
    contactMessages: [],
    auditLog: [],
    searchLog: [],
    products,
  };

  if (generated) {
    console.warn(
      `[db] Production first boot: created administrator "${email}" with a generated password (shown once, change it after signing in):\n  ${password}`,
    );
  }
  return result;
}

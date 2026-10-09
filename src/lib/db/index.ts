import "server-only";
import path from "node:path";
import { env } from "@/lib/env";
import { COLLECTION_NAMES } from "./collections";
import type { CollectionMap, CollectionName, Database, GetDb, Repository } from "./contracts";
import { createJsonDatabase, type JsonDatabase } from "./json/database";

/**
 * Persistence entry point. THIS FOLDER is the only thing to reimplement when moving to a real database:
 * return a `Database` (see ./contracts.ts) from `getDb()` and nothing above it changes.
 *
 *   const db = getDb();                       // singleton, lazily loads (and seeds) DATA_DIR on first use
 *   await db.repo("products").get(id);
 *   await db.transaction(async (tx) => { ... tx.repo("variants").update(...) ... });
 *
 * Services may also use the `db` facade (`db.products.find(...)`), which resolves `getDb()` per call.
 */

export type { CollectionMap, CollectionName, Database, QueryOptions, Repository } from "./contracts";
export { COLLECTION_NAMES, ID_PREFIX, type SeedData } from "./collections";
export { createId, createToken } from "./id";
export { CorruptDataError, DbError, DuplicateIdError, LockTimeoutError, RecordNotFoundError, TransactionClosedError } from "./errors";
export { createJsonDatabase, JsonDatabase } from "./json/database";

const SINGLETON_KEY = Symbol.for("apexline.db.singleton");
type GlobalWithDb = typeof globalThis & { [SINGLETON_KEY]?: JsonDatabase };

/** Absolute data directory: `DATA_DIR` (default `data/runtime`) resolved against the working directory. */
export function resolveDataDir(): string {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), env.DATA_DIR);
}

function createDefaultDatabase(): JsonDatabase {
  return createJsonDatabase({
    dir: resolveDataDir(),
    // Loaded lazily so the seed (and its dependencies) never load once the data directory exists.
    seed: async () => {
      const rows = await (await import("./seed")).buildSeedRows();
      // Never ship the publicly documented demo accounts to production unless explicitly requested.
      if (env.NODE_ENV === "production" && !env.SEED_DEMO_DATA) {
        const { toProductionSeed } = await import("./seed/production");
        return toProductionSeed(rows, { adminEmail: env.ADMIN_EMAIL, adminPassword: env.ADMIN_PASSWORD });
      }
      return rows;
    },
    onSeed: (dir) => {
      if (env.NODE_ENV === "production" && env.SEED_DEMO_DATA) {
        console.warn(`[db] ${dir} was empty and has been seeded with DEMO data and DEMO credentials (SEED_DEMO_DATA=true). Change every password before going live.`);
      }
    },
  });
}

/** The process-wide database. Shared across duplicated module instances through `globalThis`. */
export const getDb: GetDb = () => {
  const g = globalThis as GlobalWithDb;
  return (g[SINGLETON_KEY] ??= createDefaultDatabase());
};

/** Drops the cached singleton so the next `getDb()` re-reads `DATA_DIR` (tests, `seed:reset`). */
export function resetDbSingleton(): void {
  delete (globalThis as GlobalWithDb)[SINGLETON_KEY];
}

export type DbFacade = Database & { readonly [K in CollectionName]: Repository<CollectionMap[K]> };

function createFacade(): DbFacade {
  const facade = {
    repo: <K extends CollectionName>(name: K) => getDb().repo(name),
    transaction: <R>(fn: (tx: Database) => Promise<R>) => getDb().transaction(fn),
  } as DbFacade;
  for (const name of COLLECTION_NAMES) {
    Object.defineProperty(facade, name, { enumerable: true, get: () => getDb().repo(name) });
  }
  return facade;
}

/** `db.products`, `db.orders`, ... one repository per collection, plus `db.repo(name)` and `db.transaction(fn)`. */
export const db: DbFacade = createFacade();

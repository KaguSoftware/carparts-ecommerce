import "server-only";
import { createAdapterFactory, type AdapterFactory } from "better-auth/adapters";
import type { BetterAuthOptions } from "better-auth";
import { createId, db } from "@/lib/db";
import type { CollectionName } from "@/lib/db";

/**
 * Better Auth database adapter on top of our JSON repositories (src/lib/db).
 *
 *   user          -> users              (+ role, locale, phone, disabled, marketingOptIn)
 *   session       -> authSessions
 *   account       -> authAccounts
 *   verification  -> authVerifications
 *
 * Dates are stored as ISO strings (`supportsDates: false`: the factory converts Date <-> string). Every read-modify-write
 * runs in a database transaction, so `consumeOne` / `incrementOne` are atomic like their SQL counterparts.
 * Swap path: replace this file with `prismaAdapter(...)` / `drizzleAdapter(...)` when the real database arrives.
 */

type Row = { id: string } & Record<string, unknown>;
type Clause = { field: string; value: unknown; operator?: string; connector?: string; mode?: string };

const AUTH_COLLECTIONS: ReadonlySet<string> = new Set(["users", "authSessions", "authAccounts", "authVerifications"]);
const ID_PREFIX: Record<string, string> = { user: "usr", users: "usr", session: "ses", authSessions: "ses", account: "acc", authAccounts: "acc", verification: "ver", authVerifications: "ver" };

function repo(model: string) {
  if (!AUTH_COLLECTIONS.has(model)) throw new Error(`[auth-adapter] unexpected model "${model}"`);
  return db.repo(model as CollectionName) as unknown as {
    get(id: string): Promise<Row | null>;
    find(options?: { where?: (r: Row) => boolean; orderBy?: { field: string; direction: "asc" | "desc" }[]; offset?: number; limit?: number }): Promise<Row[]>;
    findOne(where: (r: Row) => boolean): Promise<Row | null>;
    count(where?: (r: Row) => boolean): Promise<number>;
    insert(row: Record<string, unknown>): Promise<Row>;
    update(id: string, patch: Record<string, unknown>): Promise<Row>;
    delete(id: string): Promise<boolean>;
    deleteWhere(where: (r: Row) => boolean): Promise<number>;
  };
}

const lower = (v: unknown) => (typeof v === "string" ? v.toLowerCase() : v);

function matchClause(row: Row, c: Clause): boolean {
  const insensitive = c.mode === "insensitive";
  const raw = row[c.field];
  const a = insensitive ? lower(raw) : raw;
  const v = c.value;
  const b = insensitive ? (Array.isArray(v) ? v.map(lower) : lower(v)) : v;
  switch (c.operator ?? "eq") {
    case "eq":
      return v === null ? raw == null : a === b;
    case "ne":
      return v === null ? raw != null : a !== b;
    case "lt":
      return v != null && a != null && (a as string | number) < (b as string | number);
    case "lte":
      return v != null && a != null && (a as string | number) <= (b as string | number);
    case "gt":
      return v != null && a != null && (a as string | number) > (b as string | number);
    case "gte":
      return v != null && a != null && (a as string | number) >= (b as string | number);
    case "in":
      return Array.isArray(b) && (b as unknown[]).includes(a);
    case "not_in":
      return Array.isArray(b) && !(b as unknown[]).includes(a);
    case "contains":
      return typeof a === "string" && typeof b === "string" && a.includes(b);
    case "starts_with":
      return typeof a === "string" && typeof b === "string" && a.startsWith(b);
    case "ends_with":
      return typeof a === "string" && typeof b === "string" && a.endsWith(b);
    default:
      throw new Error(`[auth-adapter] unsupported operator "${c.operator}"`);
  }
}

function predicate(where: Clause[] | undefined): (row: Row) => boolean {
  const clauses = where ?? [];
  if (clauses.length === 0) return () => true;
  return (row) => {
    let result = matchClause(row, clauses[0] as Clause);
    for (let i = 1; i < clauses.length; i++) {
      const clause = clauses[i] as Clause;
      const next = matchClause(row, clause);
      result = clause.connector === "OR" ? result || next : result && next;
    }
    return result;
  };
}

export function jsonFileAdapter(): AdapterFactory<BetterAuthOptions> {
  let lazyOptions: BetterAuthOptions | null = null;

  // explicit type: the transaction callback below refers back to this factory
  const factory: AdapterFactory<BetterAuthOptions> = createAdapterFactory({
    config: {
      adapterId: "json-file",
      adapterName: "JSON file store",
      usePlural: false,
      supportsDates: false,
      supportsBooleans: true,
      supportsJSON: true,
      supportsArrays: true,
      supportsNumericIds: false,
      customIdGenerator: ({ model }) => createId(ID_PREFIX[model] ?? "id"),
      transaction: async (callback) => {
        // Ambient transactions: every repo call inside joins this one, so the same adapter instance is used.
        return db.transaction(async () => callback(factory(lazyOptions as BetterAuthOptions)));
      },
    },
    adapter: () => ({
      async create({ model, data }) {
        const row = { ...(data as Record<string, unknown>) };
        if (typeof row.id !== "string" || !row.id) row.id = createId(ID_PREFIX[model] ?? "id");
        return (await repo(model).insert(row)) as never;
      },

      async findOne({ model, where }) {
        return (await repo(model).findOne(predicate(where as Clause[]))) as never;
      },

      async findMany({ model, where, limit, offset, sortBy }) {
        return (await repo(model).find({
          where: predicate(where as Clause[] | undefined),
          ...(sortBy ? { orderBy: [{ field: sortBy.field, direction: sortBy.direction }] } : {}),
          offset: offset ?? 0,
          limit,
        })) as never;
      },

      async count({ model, where }) {
        return repo(model).count(predicate(where as Clause[] | undefined));
      },

      async update({ model, where, update }) {
        return db.transaction(async () => {
          const r = repo(model);
          const row = await r.findOne(predicate(where as Clause[]));
          if (!row) return null as never;
          return (await r.update(row.id, update as Record<string, unknown>)) as never;
        });
      },

      async updateMany({ model, where, update }) {
        return db.transaction(async () => {
          const r = repo(model);
          const rows = await r.find({ where: predicate(where as Clause[]) });
          for (const row of rows) await r.update(row.id, update as Record<string, unknown>);
          return rows.length;
        });
      },

      async delete({ model, where }) {
        await repo(model).deleteWhere(predicate(where as Clause[]));
      },

      async deleteMany({ model, where }) {
        return repo(model).deleteWhere(predicate(where as Clause[]));
      },

      async consumeOne({ model, where }) {
        return db.transaction(async () => {
          const r = repo(model);
          const row = await r.findOne(predicate(where as Clause[]));
          if (!row) return null as never;
          await r.delete(row.id);
          return row as never;
        });
      },

      async incrementOne({ model, where, increment, set }) {
        return db.transaction(async () => {
          const r = repo(model);
          const row = await r.findOne(predicate(where as Clause[]));
          if (!row) return null as never;
          const patch: Record<string, unknown> = { ...(set ?? {}) };
          for (const [field, delta] of Object.entries(increment)) patch[field] = (typeof row[field] === "number" ? (row[field] as number) : 0) + delta;
          return (await r.update(row.id, patch)) as never;
        });
      },
    }),
  });

  return (options) => {
    lazyOptions = options;
    return factory(options);
  };
}

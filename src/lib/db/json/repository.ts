import "server-only";
import type { Id } from "@/lib/types/domain";
import type { QueryOptions, Repository } from "../contracts";
import { DuplicateIdError, RecordNotFoundError } from "../errors";
import { createId } from "../id";
import type { JsonFileStore, Row, TxState } from "./file-store";

/** JSON round-trip: the in-memory state always equals what a reload from disk would produce. */
function normalize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const cloneRow = <T>(row: T): T => structuredClone(row);

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function sortRows<T>(rows: T[], orderBy: NonNullable<QueryOptions<T>["orderBy"]>): T[] {
  return rows.sort((a, b) => {
    for (const { field, direction } of orderBy) {
      const av = (a as Record<string, unknown>)[field];
      const bv = (b as Record<string, unknown>)[field];
      const aNil = av === undefined || av === null;
      const bNil = bv === undefined || bv === null;
      if (aNil || bNil) {
        if (aNil && bNil) continue;
        return aNil ? 1 : -1; // nulls always last
      }
      const c = compareValues(av, bv);
      if (c !== 0) return direction === "desc" ? -c : c;
    }
    return 0;
  });
}

/**
 * Repository over one collection of a JsonFileStore.
 *
 * - Reads return deep copies, writes store deep copies: callers may freely mutate what they get.
 * - `where` predicates run against the live cached rows; they must be pure and must not mutate.
 * - Unbound repositories (from `getDb().repo()`) automatically join the ambient transaction when called
 *   inside `transaction()`. Bound ones (from the `tx` argument) always use that transaction.
 * - `update`/`upsert` treat a key whose value is `undefined` as "remove this optional field".
 */
export class JsonRepository<T extends { id: Id }> implements Repository<T> {
  constructor(
    private readonly store: JsonFileStore,
    private readonly name: string,
    private readonly idPrefix: string,
    private readonly bound?: TxState,
  ) {}

  private async rows(): Promise<ReadonlyMap<string, T>> {
    await this.store.ready();
    return this.store.readRows(this.bound ?? this.store.ambient(), this.name) as ReadonlyMap<string, T>;
  }

  private async write<R>(fn: (rows: Map<string, T>) => { result: R; changed: boolean }): Promise<R> {
    await this.store.ready();
    return this.store.mutate(this.bound ?? this.store.ambient(), this.name, (rows) => fn(rows as unknown as Map<string, T>));
  }

  async get(id: Id): Promise<T | null> {
    const row = (await this.rows()).get(id);
    return row ? cloneRow(row) : null;
  }

  async getMany(ids: Id[]): Promise<T[]> {
    const rows = await this.rows();
    const out: T[] = [];
    for (const id of ids) {
      const row = rows.get(id);
      if (row) out.push(cloneRow(row));
    }
    return out;
  }

  async all(): Promise<T[]> {
    return [...(await this.rows()).values()].map(cloneRow);
  }

  async find(options: QueryOptions<T> = {}): Promise<T[]> {
    const rows = await this.rows();
    let list: T[] = [];
    if (options.where) {
      for (const row of rows.values()) if (options.where(row)) list.push(row);
    } else {
      list = [...rows.values()];
    }
    if (options.orderBy?.length) sortRows(list, options.orderBy);
    if (options.offset || options.limit !== undefined) {
      const start = Math.max(0, options.offset ?? 0);
      list = list.slice(start, options.limit === undefined ? undefined : start + Math.max(0, options.limit));
    }
    return list.map(cloneRow);
  }

  async findOne(where: (row: T) => boolean): Promise<T | null> {
    for (const row of (await this.rows()).values()) if (where(row)) return cloneRow(row);
    return null;
  }

  async count(where?: (row: T) => boolean): Promise<number> {
    const rows = await this.rows();
    if (!where) return rows.size;
    let n = 0;
    for (const row of rows.values()) if (where(row)) n++;
    return n;
  }

  async insert(input: Omit<T, "id"> & { id?: Id }): Promise<T> {
    const id = input.id || createId(this.idPrefix);
    const stored = normalize({ ...input, id }) as T;
    return this.write((rows) => {
      if (rows.has(id)) throw new DuplicateIdError(this.name, id);
      rows.set(id, stored);
      return { result: cloneRow(stored), changed: true };
    });
  }

  async update(id: Id, patch: Partial<Omit<T, "id">>): Promise<T> {
    return this.write((rows) => {
      const current = rows.get(id);
      if (!current) throw new RecordNotFoundError(this.name, id);
      const next = normalize({ ...current, ...patch, id }) as T;
      rows.set(id, next);
      return { result: cloneRow(next), changed: true };
    });
  }

  async upsert(row: T): Promise<T> {
    const stored = normalize(row);
    return this.write((rows) => {
      rows.set(stored.id, stored);
      return { result: cloneRow(stored), changed: true };
    });
  }

  async delete(id: Id): Promise<boolean> {
    return this.write((rows) => {
      const existed = rows.delete(id);
      return { result: existed, changed: existed };
    });
  }

  async deleteWhere(where: (row: T) => boolean): Promise<number> {
    return this.write((rows) => {
      const doomed: string[] = [];
      for (const [id, row] of rows) if (where(row)) doomed.push(id);
      for (const id of doomed) rows.delete(id);
      return { result: doomed.length, changed: doomed.length > 0 };
    });
  }
}

export type { Row };

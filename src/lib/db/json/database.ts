import "server-only";
import { COLLECTION_NAMES, COMPACT_COLLECTIONS, ID_PREFIX } from "../collections";
import type { CollectionMap, CollectionName, Database, Repository } from "../contracts";
import { JsonFileStore, type FileOps, type SeedRows, type TxState } from "./file-store";
import { JsonRepository } from "./repository";

/** Hands out one repository per collection, optionally bound to a transaction. */
class RepoFactory {
  private readonly cache = new Map<string, Repository<never>>();
  constructor(
    private readonly store: JsonFileStore,
    private readonly bound?: TxState,
  ) {}

  get<K extends CollectionName>(name: K): Repository<CollectionMap[K]> {
    let repo = this.cache.get(name);
    if (!repo) {
      repo = new JsonRepository<{ id: string }>(this.store, name, ID_PREFIX[name], this.bound) as unknown as Repository<never>;
      this.cache.set(name, repo);
    }
    return repo as unknown as Repository<CollectionMap[K]>;
  }
}

/** `tx` handed to a transaction callback: same API, every operation goes through that transaction. */
class TransactionDatabase implements Database {
  private readonly repos: RepoFactory;
  constructor(
    private readonly store: JsonFileStore,
    private readonly state: TxState,
  ) {
    this.repos = new RepoFactory(store, state);
  }

  repo<K extends CollectionName>(name: K): Repository<CollectionMap[K]> {
    return this.repos.get(name);
  }

  transaction<R>(fn: (tx: Database) => Promise<R>): Promise<R> {
    return runNested(this.state, this, fn);
  }
}

/** Nested transactions join the outer one; a throw rolls back to the savepoint taken on entry. */
async function runNested<R>(state: TxState, db: Database, fn: (tx: Database) => Promise<R>): Promise<R> {
  const savepoint = state.snapshot();
  try {
    return await fn(db);
  } catch (error) {
    state.restore(savepoint);
    throw error;
  }
}

export interface JsonDatabaseOptions {
  dir: string;
  seed?: () => Promise<SeedRows> | SeedRows;
  lockTimeoutMs?: number;
  fs?: FileOps;
  onSeed?: (dir: string) => void;
  reloadCheckMs?: number;
}

export class JsonDatabase implements Database {
  readonly store: JsonFileStore;
  private readonly repos: RepoFactory;

  constructor(options: JsonDatabaseOptions) {
    this.store = new JsonFileStore({
      dir: options.dir,
      collections: COLLECTION_NAMES,
      compact: COMPACT_COLLECTIONS,
      seed: options.seed,
      lockTimeoutMs: options.lockTimeoutMs,
      fs: options.fs,
      onSeed: options.onSeed,
      reloadCheckMs: options.reloadCheckMs,
    });
    this.repos = new RepoFactory(this.store);
  }

  /** Loads (and seeds, on first run) the data directory. Optional: every operation awaits it lazily. */
  ready(): Promise<void> {
    return this.store.ready();
  }

  repo<K extends CollectionName>(name: K): Repository<CollectionMap[K]> {
    return this.repos.get(name);
  }

  async transaction<R>(fn: (tx: Database) => Promise<R>): Promise<R> {
    const ambient = this.store.ambient();
    if (ambient) return runNested(ambient, new TransactionDatabase(this.store, ambient), fn);
    return this.store.runTransaction((state) => fn(new TransactionDatabase(this.store, state)));
  }
}

export function createJsonDatabase(options: JsonDatabaseOptions): JsonDatabase {
  return new JsonDatabase(options);
}

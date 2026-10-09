import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import nodeFs from "node:fs/promises";
import path from "node:path";
import { CorruptDataError, TransactionClosedError } from "../errors";
import { Mutex } from "./mutex";

/**
 * JSON-file persistence engine (the stand-in for a real database).
 *
 * - One `<collection>.json` file per collection, loaded lazily on first use and cached in memory.
 * - Every commit writes `<file>.<pid>.<n>.tmp`, fsyncs it, then renames it over the target (atomic on the
 *   same volume), so a crash leaves either the old or the new file, never a torn one.
 * - A commit that touches several collections first writes a roll-forward journal, so after a crash the
 *   next boot completes the commit: all collections or none become visible together.
 * - All writes (single operations and transactions) are serialised by one in-process FIFO mutex.
 * - Transactions use copy-on-write overlays: reads inside see their own writes, nothing is visible to the
 *   rest of the process until commit, and a throw discards everything.
 * - `AsyncLocalStorage` makes a transaction *ambient*: any `getDb().repo(..)` call made inside the callback
 *   (for example from another service function) joins it instead of deadlocking on the mutex.
 *
 * Scale-out is not supported (the mutex is process-local); that is what the real-DB swap is for.
 */

export type Row = { id: string };
export type Rows = Map<string, Row>;
export type SeedRows = Partial<Record<string, readonly unknown[]>>;

/** The subset of `node:fs/promises` the store uses; injectable so tests can simulate disk failures. */
export type FileOps = Pick<typeof nodeFs, "mkdir" | "open" | "readFile" | "readdir" | "rename" | "rm" | "stat">;

export interface JsonFileStoreOptions {
  /** Directory holding the collection files (created when missing). */
  dir: string;
  /** Every collection the store manages. */
  collections: readonly string[];
  /** Produces the initial rows on first run (and for collections whose file is missing later). */
  seed?: () => Promise<SeedRows> | SeedRows;
  /** Collections written without indentation (large / write-heavy ones). */
  compact?: readonly string[];
  /** How long a writer waits for the lock before failing with LockTimeoutError. Default 30 s. */
  lockTimeoutMs?: number;
  /** Disk access, defaults to node:fs/promises. */
  fs?: FileOps;
  /** Called once when the store seeds an empty directory. */
  onSeed?: (dir: string) => void;
  /**
   * How often (ms) a running store checks whether another process re-seeded the directory (`npm run seed:reset`)
   * and, if so, reloads it. 0 = check on every operation, Infinity = never. Default 1000.
   */
  reloadCheckMs?: number;
}

const META_FILE = "_meta.json";
const JOURNAL_FILE = "_journal.json";
const INIT_LOCK_DIR = ".init.lock";
const SCHEMA_VERSION = 1;

/** State of one in-flight transaction. */
export class TxState {
  closed = false;
  /** Writable copies of the collections this transaction has touched (copy-on-first-write). */
  readonly overlay = new Map<string, Rows>();
  readonly dirty = new Set<string>();

  draft(name: string, base: Rows | undefined): Rows {
    let rows = this.overlay.get(name);
    if (!rows) {
      rows = new Map(base);
      this.overlay.set(name, rows);
    }
    return rows;
  }

  snapshot(): TxSnapshot {
    const overlay = new Map<string, Rows>();
    for (const [name, rows] of this.overlay) overlay.set(name, new Map(rows));
    return { overlay, dirty: new Set(this.dirty) };
  }

  restore(snapshot: TxSnapshot): void {
    this.overlay.clear();
    for (const [name, rows] of snapshot.overlay) this.overlay.set(name, rows);
    this.dirty.clear();
    for (const name of snapshot.dirty) this.dirty.add(name);
  }
}

export interface TxSnapshot {
  overlay: Map<string, Rows>;
  dirty: Set<string>;
}

interface TxContext {
  store: JsonFileStore;
  state: TxState;
  parent?: TxContext;
}

// Shared across duplicated module instances (Next bundles route handlers and RSC separately).
const STORAGE_KEY = Symbol.for("apexline.db.txStorage");
const globalWithStorage = globalThis as typeof globalThis & { [STORAGE_KEY]?: AsyncLocalStorage<TxContext> };
const txStorage: AsyncLocalStorage<TxContext> = (globalWithStorage[STORAGE_KEY] ??= new AsyncLocalStorage<TxContext>());

let tmpCounter = 0;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const errCode = (e: unknown) => (e as NodeJS.ErrnoException | undefined)?.code;

export class JsonFileStore {
  readonly dir: string;
  private readonly names: readonly string[];
  private readonly nameSet: ReadonlySet<string>;
  private readonly compact: ReadonlySet<string>;
  private readonly fs: FileOps;
  private readonly mutex: Mutex;
  private readonly committed = new Map<string, Rows>();
  private readyPromise: Promise<void> | null = null;
  private seedCache: Promise<SeedRows> | null = null;
  private metaStamp: string | null = null;
  private lastStaleCheck = 0;

  constructor(private readonly options: JsonFileStoreOptions) {
    this.dir = path.resolve(options.dir);
    this.names = options.collections;
    this.nameSet = new Set(options.collections);
    this.compact = new Set(options.compact ?? []);
    this.fs = options.fs ?? nodeFs;
    this.mutex = new Mutex(options.lockTimeoutMs ?? 30_000);
  }

  /* ------------------------------------------------------------------ lifecycle */

  /** Idempotent; resolves once the directory exists, is seeded when new, and every collection is cached. */
  ready(): Promise<void> {
    this.readyPromise ??= this.initialize().catch((error) => {
      this.readyPromise = null; // allow a retry after the cause is fixed
      throw error;
    });
    return this.readyPromise.then(() => this.reloadIfReseeded());
  }

  /** Another process (e.g. `npm run seed:reset`) replaced the data directory: drop our cache and reload it. */
  private async reloadIfReseeded(): Promise<void> {
    const interval = this.options.reloadCheckMs ?? 1000;
    const now = Date.now();
    if (interval === Infinity || now - this.lastStaleCheck < interval || this.ambient()) return;
    this.lastStaleCheck = now;
    const meta = await this.readMeta();
    if (!meta || meta.stamp === this.metaStamp) return;
    await this.mutex.run(async () => {
      const again = await this.readMeta();
      if (!again || again.stamp === this.metaStamp) return;
      const fresh = new Map<string, Rows>();
      for (const name of this.names) fresh.set(name, await this.loadCollection(name));
      for (const [name, rows] of fresh) this.committed.set(name, rows);
      this.metaStamp = again.stamp;
    });
  }

  fileFor(name: string): string {
    return path.join(this.dir, `${name}.json`);
  }

  private async initialize(): Promise<void> {
    await this.fs.mkdir(this.dir, { recursive: true });
    await this.recoverJournal();
    await this.cleanStaleTempFiles();
    if (!(await this.readMeta())) await this.seedEmptyDirectory();
    for (const name of this.names) this.committed.set(name, await this.loadCollection(name));
    this.metaStamp = (await this.readMeta())?.stamp ?? null;
  }

  private async seedEmptyDirectory(): Promise<void> {
    await this.withInitLock(async () => {
      if (await this.readMeta()) return; // another process finished while we waited
      const seed = await this.getSeed();
      for (const name of this.names) {
        const rows = this.toRows(name, seed[name] ?? []);
        await this.atomicWrite(this.fileFor(name), this.serialize(name, rows));
      }
      const meta = { schemaVersion: SCHEMA_VERSION, seededAt: new Date().toISOString(), seedId: randomUUID(), collections: this.names };
      await this.atomicWrite(path.join(this.dir, META_FILE), JSON.stringify(meta, null, 2) + "\n");
      this.options.onSeed?.(this.dir);
    });
  }

  private getSeed(): Promise<SeedRows> {
    this.seedCache ??= Promise.resolve(this.options.seed?.() ?? {});
    return this.seedCache;
  }

  private async readMeta(): Promise<{ schemaVersion: number; stamp: string } | null> {
    try {
      const parsed = JSON.parse(stripBom(await this.fs.readFile(path.join(this.dir, META_FILE), "utf8"))) as { schemaVersion?: number; seedId?: string; seededAt?: string };
      return typeof parsed.schemaVersion === "number" ? { schemaVersion: parsed.schemaVersion, stamp: parsed.seedId ?? parsed.seededAt ?? "" } : null;
    } catch (error) {
      if (errCode(error) === "ENOENT" || error instanceof SyntaxError) return null;
      throw error;
    }
  }

  private async loadCollection(name: string): Promise<Rows> {
    const file = this.fileFor(name);
    let text: string;
    try {
      text = await this.fs.readFile(file, "utf8");
    } catch (error) {
      if (errCode(error) !== "ENOENT") throw error;
      // A collection added after the data directory was created: start from its seed rows (or empty).
      const rows = this.toRows(name, (await this.getSeed())[name] ?? []);
      await this.atomicWrite(file, this.serialize(name, rows));
      return rows;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripBom(text));
    } catch (cause) {
      throw new CorruptDataError(file, "invalid JSON", { cause });
    }
    if (!Array.isArray(parsed)) throw new CorruptDataError(file, "expected a JSON array of records");
    const rows: Rows = new Map();
    for (const item of parsed) {
      const id = (item as { id?: unknown } | null)?.id;
      if (typeof id !== "string" || !id) throw new CorruptDataError(file, "a record has no string id");
      if (rows.has(id)) throw new CorruptDataError(file, `duplicate id "${id}"`);
      rows.set(id, item as Row);
    }
    return rows;
  }

  /** Validates + normalises raw rows (JSON round-trip) into a Map. Throws on missing / duplicate ids. */
  private toRows(name: string, input: readonly unknown[]): Rows {
    const rows: Rows = new Map();
    for (const item of input) {
      const row = JSON.parse(JSON.stringify(item)) as Row;
      if (typeof row?.id !== "string" || !row.id) throw new Error(`Seed row in "${name}" has no string id`);
      if (rows.has(row.id)) throw new Error(`Seed collection "${name}" has duplicate id "${row.id}"`);
      rows.set(row.id, row);
    }
    return rows;
  }

  /* ------------------------------------------------------------------ crash recovery & housekeeping */

  /** Finishes a multi-collection commit that was interrupted after its journal became durable. */
  private async recoverJournal(): Promise<void> {
    const journal = path.join(this.dir, JOURNAL_FILE);
    let text: string;
    try {
      text = await this.fs.readFile(journal, "utf8");
    } catch (error) {
      if (errCode(error) === "ENOENT") return;
      throw error;
    }
    let parsed: { files?: { name: string; text: string }[] };
    try {
      parsed = JSON.parse(text);
    } catch {
      await this.fs.rm(journal, { force: true }); // torn journal => the commit never became durable
      return;
    }
    for (const entry of parsed.files ?? []) {
      if (!this.nameSet.has(entry.name)) continue;
      await this.atomicWrite(this.fileFor(entry.name), entry.text);
    }
    await this.fs.rm(journal, { force: true });
  }

  private async cleanStaleTempFiles(): Promise<void> {
    try {
      const entries = await this.fs.readdir(this.dir);
      const cutoff = Date.now() - 10 * 60_000;
      for (const entry of entries) {
        if (!entry.endsWith(".tmp")) continue;
        const file = path.join(this.dir, entry);
        const stat = await this.fs.stat(file).catch(() => null);
        if (stat && stat.mtimeMs < cutoff) await this.fs.rm(file, { force: true });
      }
    } catch {
      /* best effort */
    }
  }

  /** Cross-process guard for first-run seeding (e.g. several `next build` workers starting together). */
  private async withInitLock<T>(fn: () => Promise<T>): Promise<T> {
    const lockDir = path.join(this.dir, INIT_LOCK_DIR);
    const deadline = Date.now() + 60_000;
    for (;;) {
      try {
        await this.fs.mkdir(lockDir);
        break;
      } catch (error) {
        if (errCode(error) !== "EEXIST") throw error;
        const stat = await this.fs.stat(lockDir).catch(() => null);
        if (stat && Date.now() - stat.mtimeMs > 120_000) {
          await this.fs.rm(lockDir, { recursive: true, force: true }); // stale lock from a crashed process
          continue;
        }
        if (Date.now() > deadline) throw new Error(`Timed out waiting for the seed lock at ${lockDir}`);
        await sleep(100);
      }
    }
    try {
      return await fn();
    } finally {
      await this.fs.rm(lockDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /* ------------------------------------------------------------------ reads & writes */

  /** The transaction the current async context is running in (for this store), if any. */
  ambient(): TxState | undefined {
    for (let ctx = txStorage.getStore(); ctx; ctx = ctx.parent) {
      if (ctx.store === this && !ctx.state.closed) return ctx.state;
    }
    return undefined;
  }

  /** Rows visible to `state` (its own writes) or the last committed state. Call after `ready()`. */
  readRows(state: TxState | undefined, name: string): ReadonlyMap<string, Row> {
    if (state?.closed) throw new TransactionClosedError();
    const own = state?.overlay.get(name);
    if (own) return own;
    const rows = this.committed.get(name);
    if (!rows) throw new Error(`Unknown collection "${name}"`);
    return rows;
  }

  /**
   * Applies `fn` to a writable copy of `name`. Inside a transaction the copy lives in the overlay (persisted at
   * commit); outside it takes the write lock, persists immediately and then publishes the new state.
   */
  async mutate<R>(state: TxState | undefined, name: string, fn: (rows: Rows) => { result: R; changed: boolean }): Promise<R> {
    if (state) {
      if (state.closed) throw new TransactionClosedError();
      const base = this.committed.get(name);
      if (!base) throw new Error(`Unknown collection "${name}"`);
      const outcome = fn(state.draft(name, base));
      if (outcome.changed) state.dirty.add(name);
      return outcome.result;
    }
    return this.mutex.run(async () => {
      const base = this.committed.get(name);
      if (!base) throw new Error(`Unknown collection "${name}"`);
      const draft: Rows = new Map(base);
      const outcome = fn(draft);
      if (outcome.changed) {
        await this.persist(new Map([[name, draft]]));
        this.committed.set(name, draft);
      }
      return outcome.result;
    });
  }

  /** Runs `fn` as the exclusive write transaction; commits when it resolves, discards everything when it throws. */
  async runTransaction<R>(fn: (state: TxState) => Promise<R>): Promise<R> {
    await this.ready();
    return this.mutex.run(async () => {
      const state = new TxState();
      try {
        const result = await txStorage.run({ store: this, state, parent: txStorage.getStore() }, () => fn(state));
        await this.commit(state);
        return result;
      } finally {
        state.closed = true;
      }
    });
  }

  private async commit(state: TxState): Promise<void> {
    const drafts = new Map<string, Rows>();
    for (const name of state.dirty) {
      const rows = state.overlay.get(name);
      if (rows) drafts.set(name, rows);
    }
    if (drafts.size === 0) return;
    await this.persist(drafts);
    for (const [name, rows] of drafts) this.committed.set(name, rows);
  }

  /* ------------------------------------------------------------------ disk */

  private serialize(name: string, rows: Rows): string {
    const list = [...rows.values()];
    return (this.compact.has(name) ? JSON.stringify(list) : JSON.stringify(list, null, 2)) + "\n";
  }

  /** Durably writes the given collections. Several at once go through the roll-forward journal. */
  private async persist(drafts: Map<string, Rows>): Promise<void> {
    const entries = [...drafts].map(([name, rows]) => ({ name, text: this.serialize(name, rows) }));
    if (entries.length === 1) {
      const [only] = entries as [{ name: string; text: string }];
      await this.atomicWrite(this.fileFor(only.name), only.text);
      return;
    }
    const journal = path.join(this.dir, JOURNAL_FILE);
    await this.atomicWrite(journal, JSON.stringify({ version: SCHEMA_VERSION, files: entries }));
    try {
      for (const entry of entries) await this.atomicWrite(this.fileFor(entry.name), entry.text);
    } catch (error) {
      try {
        // Put the previously committed state back so disk matches memory, then drop the journal.
        for (const entry of entries) {
          const previous = this.committed.get(entry.name);
          if (previous) await this.atomicWrite(this.fileFor(entry.name), this.serialize(entry.name, previous));
        }
        await this.fs.rm(journal, { force: true });
      } catch {
        // Disk is unusable: the journal stays and the next boot rolls the commit forward.
      }
      throw error;
    }
    await this.fs.rm(journal, { force: true });
  }

  private async atomicWrite(file: string, text: string): Promise<void> {
    const tmp = `${file}.${process.pid}.${++tmpCounter}.tmp`;
    try {
      const handle = await this.fs.open(tmp, "w");
      try {
        await handle.writeFile(text, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await this.renameWithRetry(tmp, file);
    } catch (error) {
      await this.fs.rm(tmp, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  /** Windows can briefly lock the target (antivirus, indexer): retry transient rename failures. */
  private async renameWithRetry(from: string, to: string): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      try {
        await this.fs.rename(from, to);
        return;
      } catch (error) {
        const transient = ["EPERM", "EBUSY", "EACCES"].includes(errCode(error) ?? "");
        if (!transient || attempt >= 6) throw error;
        await sleep(15 * (attempt + 1));
      }
    }
  }
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

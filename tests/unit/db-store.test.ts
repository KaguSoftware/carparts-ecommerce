import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { COLLECTION_NAMES } from "@/lib/db/collections";
import type { CollectionMap } from "@/lib/db/contracts";
import { CorruptDataError, DuplicateIdError, LockTimeoutError, RecordNotFoundError, TransactionClosedError } from "@/lib/db/errors";
import { createJsonDatabase, type JsonDatabaseOptions } from "@/lib/db/json/database";
import type { FileOps } from "@/lib/db/json/file-store";

type Attempt = CollectionMap["loginAttempts"];
type Search = CollectionMap["searchLog"];

const NOW = "2026-01-01T00:00:00.000Z";
const attempt = (id: string, failures = 0): Attempt => ({ id, key: `k-${id}`, failures, updatedAt: NOW });
const search = (id: string, q = id): Search => ({ id, q, resultCount: 1, at: NOW });

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "apexline-db-"));
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

function open(options: Partial<JsonDatabaseOptions> = {}) {
  return createJsonDatabase({ dir, ...options });
}

/** FileOps that fails `rename` for files matching `pattern` (once or always). */
function failingRename(pattern: RegExp, opts: { times?: number } = {}): FileOps {
  let remaining = opts.times ?? Infinity;
  return {
    ...fs,
    mkdir: fs.mkdir,
    open: fs.open,
    readFile: fs.readFile,
    readdir: fs.readdir,
    rm: fs.rm,
    stat: fs.stat,
    rename: async (from: Parameters<typeof fs.rename>[0], to: Parameters<typeof fs.rename>[1]) => {
      if (remaining > 0 && pattern.test(String(to))) {
        remaining--;
        throw Object.assign(new Error("simulated disk failure"), { code: "EIO" });
      }
      return fs.rename(from, to);
    },
  } as FileOps;
}

async function readJson(name: string): Promise<unknown[]> {
  return JSON.parse(await fs.readFile(path.join(dir, `${name}.json`), "utf8"));
}

describe("first run and reload", () => {
  it("seeds an empty directory once and writes every collection plus a marker", async () => {
    let seedCalls = 0;
    const db = open({
      seed: () => {
        seedCalls++;
        return { searchLog: [search("s1"), search("s2")] };
      },
    });
    expect(await db.repo("searchLog").count()).toBe(2);
    for (const name of COLLECTION_NAMES) expect(await readJson(name)).toBeInstanceOf(Array);
    expect((await readJson("searchLog")).length).toBe(2);
    await expect(fs.stat(path.join(dir, "_meta.json"))).resolves.toBeTruthy();

    await db.repo("searchLog").insert(search("s3"));
    const again = open({
      seed: () => {
        seedCalls++;
        return { searchLog: [search("other")] };
      },
    });
    expect((await again.repo("searchLog").all()).map((r) => r.id)).toEqual(["s1", "s2", "s3"]);
    expect(seedCalls).toBe(1);
  });

  it("reloads committed data from disk in a fresh instance", async () => {
    const a = open();
    await a.repo("loginAttempts").insert(attempt("a1", 3));
    await a.repo("loginAttempts").update("a1", { failures: 4 });
    const b = open();
    expect(await b.repo("loginAttempts").get("a1")).toEqual(attempt("a1", 4));
  });

  it("fills a collection whose file is missing from the seed without touching the others", async () => {
    const a = open({ seed: () => ({ searchLog: [search("s1")] }) });
    await a.repo("loginAttempts").insert(attempt("keep"));
    await fs.rm(path.join(dir, "searchLog.json"));
    const b = open({ seed: () => ({ searchLog: [search("s1"), search("s2")] }) });
    expect(await b.repo("searchLog").count()).toBe(2);
    expect(await b.repo("loginAttempts").count()).toBe(1);
  });

  it("refuses to start on a corrupt file and does not overwrite it", async () => {
    const a = open();
    await a.repo("loginAttempts").insert(attempt("a1"));
    const file = path.join(dir, "loginAttempts.json");
    await fs.writeFile(file, "{ not json", "utf8");
    const b = open();
    await expect(b.repo("loginAttempts").all()).rejects.toBeInstanceOf(CorruptDataError);
    expect(await fs.readFile(file, "utf8")).toBe("{ not json");
  });

  it("rejects duplicate ids found on disk", async () => {
    const a = open();
    await a.ready();
    await fs.writeFile(path.join(dir, "loginAttempts.json"), JSON.stringify([attempt("x"), attempt("x")]), "utf8");
    await expect(open().repo("loginAttempts").all()).rejects.toBeInstanceOf(CorruptDataError);
  });

  it("reloads when another process wipes and re-seeds the directory (npm run seed:reset)", async () => {
    const a = open({ reloadCheckMs: 0, seed: () => ({ searchLog: [search("old")] }) });
    expect((await a.repo("searchLog").all()).map((r) => r.id)).toEqual(["old"]);

    for (const entry of await fs.readdir(dir)) await fs.rm(path.join(dir, entry), { recursive: true, force: true });
    await open({ seed: () => ({ searchLog: [search("new")] }) }).ready();

    expect((await a.repo("searchLog").all()).map((r) => r.id)).toEqual(["new"]);
    await a.repo("searchLog").insert(search("more"));
    expect((await open().repo("searchLog").all()).map((r) => r.id)).toEqual(["new", "more"]);
  });

  it("does not reload when the check is disabled", async () => {
    const a = open({ reloadCheckMs: Infinity, seed: () => ({ searchLog: [search("old")] }) });
    await a.ready();
    for (const entry of await fs.readdir(dir)) await fs.rm(path.join(dir, entry), { recursive: true, force: true });
    await open({ seed: () => ({ searchLog: [search("new")] }) }).ready();
    expect((await a.repo("searchLog").all()).map((r) => r.id)).toEqual(["old"]);
  });

  it("tolerates a UTF-8 BOM added by an editor", async () => {
    await open().ready();
    await fs.writeFile(path.join(dir, "loginAttempts.json"), "﻿" + JSON.stringify([attempt("bom")]), "utf8");
    expect(await open().repo("loginAttempts").get("bom")).not.toBeNull();
  });
});

describe("repository operations", () => {
  it("supports insert, get, getMany, update, upsert, delete and deleteWhere", async () => {
    const repo = open().repo("loginAttempts");
    const created = await repo.insert({ key: "k", failures: 0, updatedAt: NOW });
    expect(created.id).toMatch(/^lga_[0-9a-z]{12}$/);
    await repo.insert(attempt("b", 1));
    await repo.insert(attempt("c", 2));

    expect(await repo.get("missing")).toBeNull();
    expect((await repo.getMany(["c", "nope", "b"])).map((r) => r.id)).toEqual(["c", "b"]);

    const updated = await repo.update("b", { failures: 9, lockedUntil: NOW });
    expect(updated).toMatchObject({ id: "b", failures: 9, lockedUntil: NOW });
    const cleared = await repo.update("b", { lockedUntil: undefined });
    expect("lockedUntil" in cleared).toBe(false);

    await repo.upsert(attempt("d", 5));
    await repo.upsert({ ...attempt("d", 6) });
    expect((await repo.get("d"))?.failures).toBe(6);

    expect(await repo.delete("d")).toBe(true);
    expect(await repo.delete("d")).toBe(false);
    expect(await repo.deleteWhere((r) => r.failures >= 2)).toBe(2); // b (9) and c (2)
    expect(await repo.count()).toBe(1); // the generated one remains
  });

  it("rejects duplicate inserts and updates of missing rows", async () => {
    const repo = open().repo("loginAttempts");
    await repo.insert(attempt("a"));
    await expect(repo.insert(attempt("a"))).rejects.toBeInstanceOf(DuplicateIdError);
    await expect(repo.update("zzz", { failures: 1 })).rejects.toBeInstanceOf(RecordNotFoundError);
    expect(await repo.count()).toBe(1);
  });

  it("filters, orders (nulls last), offsets and limits", async () => {
    const repo = open().repo("loginAttempts");
    await repo.insert({ ...attempt("a", 3), lockedUntil: "2026-02-01T00:00:00.000Z" });
    await repo.insert({ ...attempt("b", 1), lockedUntil: null });
    await repo.insert({ ...attempt("c", 3), lockedUntil: "2026-01-15T00:00:00.000Z" });
    await repo.insert(attempt("d", 2));

    const byFailuresDesc = await repo.find({ orderBy: [{ field: "failures", direction: "desc" }, { field: "id", direction: "asc" }] });
    expect(byFailuresDesc.map((r) => r.id)).toEqual(["a", "c", "d", "b"]);
    const byLocked = await repo.find({ orderBy: [{ field: "lockedUntil", direction: "asc" }] });
    expect(byLocked.map((r) => r.id)).toEqual(["c", "a", "b", "d"]); // null / missing last
    const byLockedDesc = await repo.find({ orderBy: [{ field: "lockedUntil", direction: "desc" }] });
    expect(byLockedDesc.map((r) => r.id)).toEqual(["a", "c", "b", "d"]);
    const page = await repo.find({ where: (r) => r.failures > 1, orderBy: [{ field: "id", direction: "asc" }], offset: 1, limit: 1 });
    expect(page.map((r) => r.id)).toEqual(["c"]);
    expect(await repo.findOne((r) => r.failures === 2)).toMatchObject({ id: "d" });
    expect(await repo.findOne((r) => r.failures === 99)).toBeNull();
    expect(await repo.count((r) => r.failures === 3)).toBe(2);
  });

  it("returns copies: mutating results or inputs never touches stored data", async () => {
    const repo = open().repo("carts");
    const input = {
      id: "c1",
      userId: null,
      items: [{ variantId: "v1", quantity: 1, addedAt: NOW, priceAtAdd: 100 }],
      expiresAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    };
    await repo.insert(input);
    input.items[0]!.quantity = 99;
    const read = (await repo.get("c1"))!;
    read.items[0]!.quantity = 42;
    read.items.push({ variantId: "v2", quantity: 1, addedAt: NOW, priceAtAdd: 1 });
    const again = (await repo.get("c1"))!;
    expect(again.items).toHaveLength(1);
    expect(again.items[0]!.quantity).toBe(1);
  });

  it("normalises like a reload would (undefined keys are dropped)", async () => {
    const repo = open().repo("loginAttempts");
    const row = await repo.insert({ ...attempt("n"), lockedUntil: undefined });
    expect("lockedUntil" in row).toBe(false);
  });
});

describe("atomic persistence", () => {
  it("never leaves temp files behind and always writes valid JSON", async () => {
    const db = open();
    for (let i = 0; i < 20; i++) await db.repo("searchLog").insert(search(`s${i}`));
    await db.transaction(async (tx) => {
      await tx.repo("searchLog").insert(search("tx1"));
      await tx.repo("loginAttempts").insert(attempt("tx1"));
    });
    const files = await fs.readdir(dir);
    expect(files.filter((f) => f.endsWith(".tmp"))).toEqual([]);
    expect(files).not.toContain("_journal.json");
    expect((await readJson("searchLog")).length).toBe(21);
  });

  it("keeps the old file and the old in-memory state when a write fails", async () => {
    const healthy = open();
    await healthy.repo("searchLog").insert(search("before"));

    const failing = open({ fs: failingRename(/searchLog\.json$/) });
    await expect(failing.repo("searchLog").insert(search("lost"))).rejects.toThrow("simulated disk failure");
    expect((await failing.repo("searchLog").all()).map((r) => r.id)).toEqual(["before"]);
    expect(((await readJson("searchLog")) as Search[]).map((r) => r.id)).toEqual(["before"]);
    expect((await fs.readdir(dir)).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });

  it("rolls a failed multi-collection commit back on disk and in memory", async () => {
    const healthy = open();
    await healthy.repo("searchLog").insert(search("a"));
    await healthy.repo("loginAttempts").insert(attempt("a"));

    // Fail the SECOND data file of the commit (loginAttempts) exactly once.
    const db = open({ fs: failingRename(/loginAttempts\.json$/, { times: 1 }) });
    await expect(
      db.transaction(async (tx) => {
        await tx.repo("searchLog").insert(search("b"));
        await tx.repo("loginAttempts").insert(attempt("b"));
      }),
    ).rejects.toThrow("simulated disk failure");

    expect((await db.repo("searchLog").all()).map((r) => r.id)).toEqual(["a"]);
    expect((await db.repo("loginAttempts").all()).map((r) => r.id)).toEqual(["a"]);
    expect((await readJson("searchLog")).length).toBe(1);
    expect((await readJson("loginAttempts")).length).toBe(1);
    expect(await fs.readdir(dir)).not.toContain("_journal.json");
    // and the store keeps working afterwards
    await db.repo("searchLog").insert(search("c"));
    expect(await db.repo("searchLog").count()).toBe(2);
  });

  it("rolls an interrupted multi-collection commit forward on the next boot", async () => {
    await open().ready();
    const journal = {
      version: 1,
      files: [
        { name: "searchLog", text: JSON.stringify([search("j1")]) + "\n" },
        { name: "loginAttempts", text: JSON.stringify([attempt("j1")]) + "\n" },
      ],
    };
    await fs.writeFile(path.join(dir, "_journal.json"), JSON.stringify(journal), "utf8");
    const db = open();
    expect((await db.repo("searchLog").all()).map((r) => r.id)).toEqual(["j1"]);
    expect((await db.repo("loginAttempts").all()).map((r) => r.id)).toEqual(["j1"]);
    expect(await fs.readdir(dir)).not.toContain("_journal.json");
  });

  it("discards a torn journal (commit never became durable)", async () => {
    const a = open();
    await a.repo("searchLog").insert(search("keep"));
    await fs.writeFile(path.join(dir, "_journal.json"), '{"version":1,"files":[{"name":"searchLog","te', "utf8");
    const b = open();
    expect((await b.repo("searchLog").all()).map((r) => r.id)).toEqual(["keep"]);
    expect(await fs.readdir(dir)).not.toContain("_journal.json");
  });
});

describe("transactions", () => {
  it("sees its own writes and publishes all of them together on commit", async () => {
    const db = open();
    await db.transaction(async (tx) => {
      await tx.repo("searchLog").insert(search("t1"));
      await tx.repo("loginAttempts").insert(attempt("t1"));
      expect(await tx.repo("searchLog").count()).toBe(1);
      // an unbound repository used inside the callback joins the same transaction
      expect(await db.repo("loginAttempts").count()).toBe(1);
    });
    expect(await db.repo("searchLog").count()).toBe(1);
    expect(await db.repo("loginAttempts").count()).toBe(1);
  });

  it("does not leak uncommitted writes to concurrent readers", async () => {
    const db = open();
    await db.repo("searchLog").insert(search("base"));
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let inserted!: () => void;
    const insertedSignal = new Promise<void>((r) => (inserted = r));
    const tx = db.transaction(async (t) => {
      await t.repo("searchLog").insert(search("pending"));
      inserted();
      await gate;
    });
    await insertedSignal;
    // A plain read in a different async context sees only committed state.
    expect(await db.repo("searchLog").count()).toBe(1);
    release();
    await tx;
    expect(await db.repo("searchLog").count()).toBe(2);
  });

  it("rolls everything back when the callback throws", async () => {
    const db = open();
    await db.repo("searchLog").insert(search("base"));
    await expect(
      db.transaction(async (tx) => {
        await tx.repo("searchLog").insert(search("gone"));
        await tx.repo("searchLog").delete("base");
        await tx.repo("loginAttempts").insert(attempt("gone"));
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect((await db.repo("searchLog").all()).map((r) => r.id)).toEqual(["base"]);
    expect(await db.repo("loginAttempts").count()).toBe(0);
    expect((await readJson("searchLog")).length).toBe(1);
    // lock is released: the next write works
    await db.repo("searchLog").insert(search("after"));
  });

  it("nested transactions join the outer one and roll back to their savepoint", async () => {
    const db = open();
    await db.transaction(async (tx) => {
      await tx.repo("searchLog").insert(search("outer"));
      await expect(
        tx.transaction(async (inner) => {
          await inner.repo("searchLog").insert(search("inner"));
          throw new Error("inner fails");
        }),
      ).rejects.toThrow("inner fails");
      await db.transaction(async (viaRoot) => {
        await viaRoot.repo("searchLog").insert(search("joined"));
      });
      expect((await tx.repo("searchLog").all()).map((r) => r.id)).toEqual(["outer", "joined"]);
    });
    expect((await db.repo("searchLog").all()).map((r) => r.id)).toEqual(["outer", "joined"]);
  });

  it("rejects use of a leaked tx after it finished", async () => {
    const db = open();
    let leaked!: Parameters<Parameters<typeof db.transaction>[0]>[0];
    await db.transaction(async (tx) => {
      leaked = tx;
    });
    await expect(leaked.repo("searchLog").insert(search("late"))).rejects.toBeInstanceOf(TransactionClosedError);
    await expect(leaked.repo("searchLog").count()).rejects.toBeInstanceOf(TransactionClosedError);
  });

  it("times out waiting for the lock instead of hanging forever", async () => {
    const db = open({ lockTimeoutMs: 80 });
    await db.ready();
    let release!: () => void;
    const hold = db.transaction(() => new Promise<void>((r) => (release = r)));
    await new Promise((r) => setTimeout(r, 10));
    await expect(db.repo("searchLog").insert(search("blocked"))).rejects.toBeInstanceOf(LockTimeoutError);
    release();
    await hold;
    await db.repo("searchLog").insert(search("free-again"));
    expect(await db.repo("searchLog").count()).toBe(1);
  });
});

describe("concurrency", () => {
  it("serialises 200 parallel read-modify-write transactions without lost updates", async () => {
    const db = open();
    await db.repo("loginAttempts").insert(attempt("counter", 0));
    await Promise.all(
      Array.from({ length: 200 }, () =>
        db.transaction(async (tx) => {
          const row = await tx.repo("loginAttempts").get("counter");
          // yield to the event loop so a missing lock would interleave
          await new Promise((r) => setImmediate(r));
          await tx.repo("loginAttempts").update("counter", { failures: row!.failures + 1 });
        }),
      ),
    );
    expect((await db.repo("loginAttempts").get("counter"))?.failures).toBe(200);
    expect((await open().repo("loginAttempts").get("counter"))?.failures).toBe(200);
  });

  it("keeps every row when 150 inserts race, and the file always parses", async () => {
    const db = open();
    await Promise.all(Array.from({ length: 150 }, (_, i) => db.repo("searchLog").insert(search(`s${i}`))));
    expect(await db.repo("searchLog").count()).toBe(150);
    const onDisk = (await readJson("searchLog")) as Search[];
    expect(new Set(onDisk.map((r) => r.id)).size).toBe(150);
  });

  it("interleaves plain writes and transactions safely", async () => {
    const db = open();
    const jobs: Promise<unknown>[] = [];
    for (let i = 0; i < 40; i++) {
      jobs.push(db.repo("searchLog").insert(search(`plain${i}`)));
      jobs.push(
        db.transaction(async (tx) => {
          await tx.repo("searchLog").insert(search(`tx${i}`));
          await tx.repo("loginAttempts").insert(attempt(`tx${i}`));
        }),
      );
    }
    await Promise.all(jobs);
    expect(await db.repo("searchLog").count()).toBe(80);
    expect(await db.repo("loginAttempts").count()).toBe(40);
    const reloaded = open();
    expect(await reloaded.repo("searchLog").count()).toBe(80);
    expect(await reloaded.repo("loginAttempts").count()).toBe(40);
  });

  it("lets two instances seed the same empty directory without corrupting it", async () => {
    const seed = () => ({ searchLog: Array.from({ length: 30 }, (_, i) => search(`seed${i}`)) });
    const dbs = [open({ seed }), open({ seed }), open({ seed })];
    const counts = await Promise.all(dbs.map((d) => d.repo("searchLog").count()));
    expect(counts).toEqual([30, 30, 30]);
    expect((await fs.readdir(dir)).filter((f) => f.includes("lock"))).toEqual([]);
  });
});

/**
 * Wipes the JSON "database" (DATA_DIR, default data/runtime) and re-seeds it.
 *
 *   npm run seed:reset
 *
 * Runs under `--conditions=react-server` (see package.json) so modules that import "server-only" load in Node.
 * A running dev server notices the new seed (`_meta.json` stamp) within about a second and reloads its cache.
 */
import { readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { COLLECTION_NAMES, getDb, resolveDataDir } from "../src/lib/db";
import { SEED_CREDENTIALS } from "../src/lib/db/seed/credentials";

async function main() {
  const dir = resolveDataDir();
  const root = path.parse(dir).root;
  const forbidden = [root, os.homedir(), process.cwd(), path.dirname(process.cwd())];
  if (forbidden.includes(dir) || dir.length < root.length + 4) {
    throw new Error(`Refusing to wipe "${dir}": DATA_DIR must point at a dedicated data directory.`);
  }

  let removed = 0;
  try {
    for (const entry of await readdir(dir)) {
      await rm(path.join(dir, entry), { recursive: true, force: true });
      removed++;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  console.log(`seed:reset  cleared ${removed} entr${removed === 1 ? "y" : "ies"} in ${dir}`);

  const db = getDb();
  const started = Date.now();
  const summary: string[] = [];
  for (const name of COLLECTION_NAMES) {
    const count = await db.repo(name).count();
    if (count > 0) summary.push(`${name}=${count}`);
  }
  console.log(`seed:reset  seeded in ${Date.now() - started} ms`);
  console.log(`            ${summary.join("  ")}`);
  console.log("\nDemo accounts (development only):");
  for (const c of Object.values(SEED_CREDENTIALS)) console.log(`  ${c.role.padEnd(8)} ${c.email.padEnd(28)} ${c.password}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

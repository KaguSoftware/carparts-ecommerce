import { rm } from "node:fs/promises";

/** Removes the throw-away data directory created for this run (see playwright.config.ts). Set E2E_KEEP_DATA=1 to inspect it. */
export default async function globalTeardown() {
  const dir = process.env.E2E_RUN_DIR;
  if (!dir || process.env.E2E_KEEP_DATA) return;
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => undefined);
}

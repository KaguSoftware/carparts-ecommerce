import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";

/**
 * Login lockout: 5 failed attempts per email+IP -> 10 minute lockout (ARCHITECTURE.md > Auth).
 * State lives in the `loginAttempts` collection so it survives restarts and works across workers sharing the DB.
 * Failure counters decay after `DECAY_MS` of inactivity.
 */
export const MAX_FAILURES = 5;
export const LOCKOUT_MS = 10 * 60_000;
const DECAY_MS = 30 * 60_000;

export function lockoutKey(email: string, ip: string): string {
  return `${email.trim().toLowerCase()}|${ip}`;
}

/** Deterministic id so reads/writes are direct lookups and the raw email is not used as an id. */
function attemptId(key: string): string {
  return `lga_${createHash("sha256").update(key).digest("hex").slice(0, 24)}`;
}

/** Seconds left on an active lockout, or 0. */
export async function lockoutRemainingSeconds(key: string, now = Date.now()): Promise<number> {
  const row = await db.loginAttempts.get(attemptId(key));
  if (!row?.lockedUntil) return 0;
  const left = Date.parse(row.lockedUntil) - now;
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

/** Throws `account_locked` while the key is locked out. */
export async function assertNotLocked(key: string): Promise<void> {
  const left = await lockoutRemainingSeconds(key);
  if (left > 0) throw new DomainError("account_locked", { status: 429, params: { retryAfter: left } });
}

export async function registerLoginFailure(key: string, now = Date.now()): Promise<{ locked: boolean; failures: number }> {
  const id = attemptId(key);
  return db.transaction(async () => {
    const row = await db.loginAttempts.get(id);
    const stale = row && !row.lockedUntil && now - Date.parse(row.updatedAt) > DECAY_MS;
    const expiredLock = row?.lockedUntil && Date.parse(row.lockedUntil) <= now;
    const previous = !row || stale || expiredLock ? 0 : row.failures;
    const failures = previous + 1;
    const locked = failures >= MAX_FAILURES;
    await db.loginAttempts.upsert({
      id,
      key: id, // never persist the raw email/IP pair
      failures: locked ? 0 : failures,
      lockedUntil: locked ? new Date(now + LOCKOUT_MS).toISOString() : null,
      updatedAt: new Date(now).toISOString(),
    });
    return { locked, failures };
  });
}

export async function registerLoginSuccess(key: string): Promise<void> {
  await db.loginAttempts.delete(attemptId(key));
}

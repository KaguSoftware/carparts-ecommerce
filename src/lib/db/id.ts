import "server-only";
import { randomBytes } from "node:crypto";

/** Crockford-style base32 (no i, l, o, u): URL safe, case-insensitive friendly, unambiguous when read aloud. */
const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

/**
 * Opaque id, e.g. `prd_7k2m9x4q1b3d`. 12 random base32 chars = 60 bits of entropy.
 * The prefix only helps debugging (`prd_` product, `ord_` order ...); never parse ids.
 */
export function createId(prefix?: string): string {
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) out += ALPHABET[(bytes[i] as number) & 31];
  return prefix ? `${prefix}_${out}` : out;
}

/** URL-safe random token (access tokens, idempotency keys, reset tokens). 32 bytes of entropy by default. */
export function createToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

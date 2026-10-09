/**
 * Idempotency key for placing an order. One key per checkout attempt, kept in sessionStorage so a retry after a
 * decline, a double click, a refresh or a dropped connection reaches the SAME server-side order instead of charging
 * twice. The key is bound to the cart contents: a different cart gets a fresh key, and it is cleared on success.
 */
const STORAGE_KEY = "apexline.checkout.attempt";

function randomKey(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    // fall through
  }
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`;
}

interface Stored {
  fingerprint: string;
  key: string;
}

export function getCheckoutKey(fingerprint: string): string {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Stored;
      if (stored.fingerprint === fingerprint && typeof stored.key === "string" && stored.key.length >= 8) return stored.key;
    }
  } catch {
    // storage unavailable or corrupt: fall through to a fresh key
  }
  const key = randomKey();
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ fingerprint, key } satisfies Stored));
  } catch {
    // private mode: the key then only lives for this page view, which is still safe against double clicks
  }
  return key;
}

export function clearCheckoutKey(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

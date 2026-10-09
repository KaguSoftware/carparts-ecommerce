/**
 * Test environment for service tests. IMPORT THIS FIRST in every service test file: it points the JSON store,
 * the mail outbox and uploads at a throwaway temp directory before any service module reads the environment.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "apexline-svc-"));

process.env.DATA_DIR = path.join(root, "runtime");
process.env.OUTBOX_DIR = path.join(root, "outbox");
process.env.UPLOAD_DIR = path.join(root, "uploads");
process.env.PAYMENT_PROVIDER = "mock";
process.env.MOCK_PAYMENT_LATENCY_MS = "0";
process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret-123456";
process.env.PAYMENT_WEBHOOK_SECRET = "test-webhook-secret-123456";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.LOG_LEVEL = "error";

export const TEST_ROOT = root;

/** Wipes the temp data dir and re-seeds from scratch (call in `beforeAll`, or `beforeEach` for isolation). */
export async function freshSeed(): Promise<void> {
  const { resetDbSingleton, getDb } = await import("@/lib/db");
  resetDbSingleton();
  fs.rmSync(process.env.DATA_DIR as string, { recursive: true, force: true });
  fs.rmSync(process.env.OUTBOX_DIR as string, { recursive: true, force: true });
  await getDb().repo("settings").count(); // first access seeds
}

export const STAFF = { id: "usr_staff", email: "staff@apexline.example", role: "staff" } as const;
export const ADMIN = { id: "usr_admin", email: "admin@apexline.example", role: "admin" } as const;
export const SYSTEM = { id: "system", role: "system" } as const;
export const CUSTOMER_ID = "usr_customer";

export const CARD_OK = { number: "4242 4242 4242 4242", expMonth: 12, expYear: new Date().getUTCFullYear() + 3, cvc: "123", holder: "Test Shopper" };

export const US_ADDRESS = {
  firstName: "Test",
  lastName: "Shopper",
  line1: "123 Main Street",
  city: "Detroit",
  region: "MI",
  postalCode: "48201",
  country: "US",
  phone: "+1 313 555 0100",
};

export const TR_ADDRESS = {
  firstName: "Test",
  lastName: "Alıcı",
  line1: "Moda Cad. No: 12",
  city: "İstanbul",
  region: "İstanbul",
  postalCode: "34710",
  country: "TR",
  phone: "+90 532 555 01 21",
};

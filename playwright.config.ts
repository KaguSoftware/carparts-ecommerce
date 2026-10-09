import path from "node:path";
import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

/**
 * Every run gets its own throw-away data directory (JSON "database", email outbox and uploads), so the suite never
 * touches `data/runtime` and always starts from a clean seed. The value is stored in process.env so that the
 * worker processes (forked after this file is loaded) and global teardown see exactly the same directory.
 */
const RUN_ID = process.env.E2E_RUN_ID ?? randomBytes(4).toString("hex");
process.env.E2E_RUN_ID = RUN_ID;
const RUN_DIR = path.resolve(process.cwd(), "data", `e2e-${RUN_ID}`);
process.env.E2E_RUN_DIR = RUN_DIR;

const serverEnv: Record<string, string> = {
  NODE_ENV: "production",
  PORT: String(PORT),
  DATA_DIR: path.join(RUN_DIR, "db"),
  OUTBOX_DIR: path.join(RUN_DIR, "outbox"),
  UPLOAD_DIR: path.join(RUN_DIR, "uploads"),
  NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
  BETTER_AUTH_URL: `http://localhost:${PORT}`,
  // Production guards require strong secrets, an explicit proxy stance and an explicit opt-in for the mock gateway.
  BETTER_AUTH_SECRET: "Kq7vN3mXr9LpT4wYb8NcH1sJd6GfA2eUzW5",
  PAYMENT_WEBHOOK_SECRET: "Hy4rTg7uIo9pAs5dFg1hJk8lZx6cVb2NmQ3",
  PAYMENT_PROVIDER: "mock",
  ALLOW_MOCK_PAYMENTS: "true",
  MOCK_PAYMENT_LATENCY_MS: "0",
  TRUST_PROXY: "true", // behind no proxy here, so every request falls into the "direct" bucket; limits are generous enough
  EMAIL_PROVIDER: "outbox",
  SEED_DEMO_DATA: "true", // the e2e flows sign in as the seeded demo admin / customer
  LOG_LEVEL: "warn",
};
Object.assign(process.env, { E2E_DATA_DIR: serverEnv.DATA_DIR, E2E_OUTBOX_DIR: serverEnv.OUTBOX_DIR });

// `E2E_SKIP_BUILD=1` reuses an existing `.next` production build (faster local iteration).
const build = process.env.E2E_SKIP_BUILD ? "" : "npm run build && ";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: {
    command: `${build}npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: serverEnv,
    stdout: "pipe",
    stderr: "pipe",
  },
});

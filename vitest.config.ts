import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // `server-only` throws when imported outside a React Server environment; unit tests run in plain Node.
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    // Inline Better Auth so tests can mock the `next/headers` module its Next.js cookie plugin imports at runtime.
    server: { deps: { inline: [/better-auth/] } },
    include: ["tests/unit/**/*.test.ts", "src/**/*.test.ts"],
    testTimeout: 30_000,
    coverage: { provider: "v8", include: ["src/lib/**"], reporter: ["text", "html"] },
  },
});

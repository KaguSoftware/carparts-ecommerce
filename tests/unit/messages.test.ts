import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(process.cwd(), "scripts", "build-messages.mjs");

/** Runs the build script against a throwaway copy of the repo layout it expects (scripts/ + messages/_src). */
function runIn(fragments: Record<string, unknown>): { ok: boolean; output: string } {
  const dir = mkdtempSync(join(tmpdir(), "msgs-"));
  mkdirSync(join(dir, "scripts"));
  mkdirSync(join(dir, "messages", "_src"), { recursive: true });
  cpSync(script, join(dir, "scripts", "build-messages.mjs"));
  for (const [name, content] of Object.entries(fragments)) writeFileSync(join(dir, "messages", "_src", name), JSON.stringify(content));
  try {
    const out = execFileSync(process.execPath, [join(dir, "scripts", "build-messages.mjs"), "--check"], { encoding: "utf8", stdio: "pipe" });
    return { ok: true, output: out };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    return { ok: false, output: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

describe("build-messages", () => {
  it("accepts matching en/tr fragments", () => {
    const r = runIn({
      "a.en.json": { a: { hello: "Hello {name}" } },
      "a.tr.json": { a: { hello: "Merhaba {name}" } },
    });
    expect(r.ok).toBe(true);
  });

  it("fails when a key exists in only one locale", () => {
    const r = runIn({
      "a.en.json": { a: { hello: "Hello", bye: "Bye" } },
      "a.tr.json": { a: { hello: "Merhaba" } },
    });
    expect(r.ok).toBe(false);
    expect(r.output).toContain("a.bye");
  });

  it("fails on ICU argument mismatch", () => {
    const r = runIn({
      "a.en.json": { a: { n: "{count} items" } },
      "a.tr.json": { a: { n: "{adet} ürün" } },
    });
    expect(r.ok).toBe(false);
    expect(r.output).toContain("ICU");
  });

  it("fails on duplicate keys across fragments", () => {
    const r = runIn({
      "a.en.json": { x: { y: "1" } },
      "a.tr.json": { x: { y: "1" } },
      "b.en.json": { x: { y: "2" } },
      "b.tr.json": { x: { y: "2" } },
    });
    expect(r.ok).toBe(false);
    expect(r.output).toContain("duplicate key");
  });

  it("fails when a locale counterpart file is missing", () => {
    const r = runIn({ "a.en.json": { a: "x" } });
    expect(r.ok).toBe(false);
    expect(r.output).toContain("missing");
  });
});

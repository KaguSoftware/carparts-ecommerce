import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PARTS, PART_IDS, isPartId, partHref, partNumber } from "@/components/engine3d/parts";
import { buildEngine } from "@/components/engine3d/model/build";
import { buildCategories } from "@/lib/db/seed/categories";
import { makeClock } from "@/lib/db/seed/util";

const fragment = (locale: "en" | "tr") => JSON.parse(readFileSync(join(process.cwd(), "messages", "_src", `engine3d.${locale}.json`), "utf8")) as { engine3d: { parts: Record<string, Record<string, string>> } };

describe("engine3d part registry", () => {
  it("has one definition per part id, with unique ids", () => {
    expect(PARTS.map((p) => p.id).sort()).toEqual([...PART_IDS].sort());
    expect(isPartId("valveCover")).toBe(true);
    expect(isPartId("flywheel")).toBe(false);
  });

  it("links every part to a real shop category", () => {
    const slugs = new Set(buildCategories(makeClock()).map((c) => c.slug));
    for (const part of PARTS) expect(slugs.has(part.categorySlug), `${part.id} -> ${part.categorySlug}`).toBe(true);
  });

  it("sends parts without a subcategory to a specific search, not the broad engine category", () => {
    for (const part of PARTS) {
      const href = partHref(part);
      if (part.searchTerm) expect(href).toBe(`/search?q=${encodeURIComponent(part.searchTerm)}`);
      else expect(href).toBe(`/category/${part.categorySlug}`);
    }
    expect(PARTS.filter((p) => p.categorySlug === "engine").every((p) => p.searchTerm), "engine parts all carry a search term").toBe(true);
    expect(partHref(PARTS.find((p) => p.id === "pistons")!)).toBe("/search?q=piston");
  });

  it("numbers parts 01..15 in legend order", () => {
    expect(PART_IDS.map(partNumber)).toEqual(Array.from({ length: 15 }, (_, i) => String(i + 1).padStart(2, "0")));
    expect(PARTS.map((p) => p.id)).toEqual([...PART_IDS]);
  });

  it("has explode windows inside 0..1 and offsets that move the part", () => {
    for (const part of PARTS) {
      const [a, b] = part.window;
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
      expect(b).toBeGreaterThan(a);
    }
    // The block is the anchor; everything else moves.
    for (const part of PARTS.filter((p) => p.id !== "block")) expect(part.explode.some((n) => n !== 0), part.id).toBe(true);
  });

  it("has en and tr copy (name, note, shop) for every part", () => {
    for (const locale of ["en", "tr"] as const) {
      const parts = fragment(locale).engine3d.parts;
      for (const id of PART_IDS) {
        for (const key of ["name", "note", "shop"]) expect(parts[id]?.[key], `${locale} ${id}.${key}`).toBeTruthy();
      }
    }
  });
});

describe("procedural engine model", () => {
  it("builds renderable geometry for every named part", () => {
    const built = buildEngine();
    for (const id of PART_IDS) {
      expect(built[id].length, id).toBeGreaterThan(0);
      for (const mesh of built[id]) {
        const count = mesh.geometry.getAttribute("position").count;
        expect(count, `${id}/${mesh.mat}`).toBeGreaterThan(0);
        expect(Number.isFinite(mesh.geometry.boundingSphere?.radius ?? NaN), `${id}/${mesh.mat} bounds`).toBe(true);
      }
    }
  });
});

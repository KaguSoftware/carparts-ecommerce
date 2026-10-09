/**
 * Generates every illustration under public/products from code as engineering line drawings: an orthographic
 * elevation on drawing paper (numbered dimensions that match the spec sheet) and a graphite section view per product,
 * plus category plates, brand badges and banners. Deterministic (no randomness, no dates), brand colours only.
 *
 *   npm run art:products
 *
 * The product list comes straight from the seed catalogue, so file names always match `Product.images[].url`.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BRAND_DEFS } from "../src/lib/db/seed/brands";
import { buildCatalog } from "../src/lib/db/seed/catalog/build";
import { TOP_SLUGS } from "../src/lib/db/seed/categories";
import { hashString, makeClock } from "../src/lib/db/seed/util";
import { buildVehicles } from "../src/lib/db/seed/vehicles";
import { pickDimensionSpecs } from "../src/lib/spec-dims";
import { DRAW, renderBanner, renderBrand, renderCategory, renderDetail, renderHero } from "./art/compose";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "products");
mkdirSync(outDir, { recursive: true });

const written = new Set<string>();
let changed = 0;

function write(file: string, svg: string) {
  const target = join(outDir, file);
  const content = svg + "\n";
  let existing: string | null = null;
  try {
    existing = readFileSync(target, "utf8");
  } catch {
    /* new file */
  }
  if (existing !== content) {
    writeFileSync(target, content);
    changed++;
  }
  written.add(file);
}

// Products: two views each.
const catalog = buildCatalog(makeClock(new Date("2026-01-01T00:00:00Z")), buildVehicles());
const productTitle = new Map(catalog.products.map((p) => [p.slug, p.name.en]));
const productDims = new Map(catalog.products.map((p) => [p.slug, pickDimensionSpecs(p.specs).length]));
for (const job of catalog.artJobs) {
  if (!DRAW[job.kind]) throw new Error(`Art kind "${job.kind}" (${job.file}) has no drawing`);
  const slug = job.file.replace(/-[12]\.svg$/, "");
  const title = productTitle.get(slug) ?? slug;
  const seed = hashString(job.seed);
  write(job.file, job.view === "hero" ? renderHero(job.kind, job.tier, seed, title, job.label, productDims.get(slug) ?? 0) : renderDetail(job.kind, job.tier, seed, `${title} (section view)`, job.label, job.code));
}

// Categories, brands, banners.
for (const slug of TOP_SLUGS) write(`cat-${slug}.svg`, renderCategory(slug, slug));
for (const b of BRAND_DEFS) write(`brand-${b.key}.svg`, renderBrand(b.name, b.country, hashString(b.key)));
for (const name of ["fitment", "brakes", "service", "deals", "select"]) write(`banner-${name}.svg`, renderBanner(name));

// Remove stale generated files (only .svg files this script owns).
let removed = 0;
for (const file of readdirSync(outDir)) {
  if (file.endsWith(".svg") && !written.has(file)) {
    rmSync(join(outDir, file));
    removed++;
  }
}

console.log(`art:products  ${written.size} files (${changed} written, ${removed} removed) in public/products`);

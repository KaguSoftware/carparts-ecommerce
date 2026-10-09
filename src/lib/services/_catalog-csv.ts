import "server-only";
import { db } from "@/lib/db";
import { DomainError, isDomainError } from "@/lib/errors";
import { minorToMajorString, parseMajorToMinor } from "@/lib/money";
import type { Actor, Product, ProductVariant } from "@/lib/types/domain";
import type { CsvImportReport, ProductInput, VariantInput } from "./contracts";
import { logAudit } from "./audit";
import { createProduct, createVariant, updateProduct, updateVariant } from "./_catalog-admin";
import { CsvParseError, parseCsvRecords, toCsv } from "./_csv";
import { setStock } from "./inventory";
import { slugify } from "@/lib/utils";

export const PRODUCT_CSV_COLUMNS = [
  "slug",
  "status",
  "name_en",
  "name_tr",
  "summary_en",
  "summary_tr",
  "description_en",
  "description_tr",
  "brand",
  "category",
  "part_number",
  "oem_numbers",
  "tags",
  "warranty_months",
  "fitment",
  "featured",
  "sku",
  "variant_name_en",
  "variant_name_tr",
  "price",
  "compare_at_price",
  "cost",
  "stock",
  "low_stock_threshold",
  "weight_grams",
  "barcode",
  "variant_active",
  "variant_default",
] as const;

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export async function exportProductsCsv(): Promise<string> {
  const [products, variants, brands, categories] = await Promise.all([db.products.all(), db.variants.all(), db.brands.all(), db.categories.all()]);
  const brandMap = new Map(brands.map((b) => [b.id, b]));
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const byProduct = new Map<string, ProductVariant[]>();
  for (const v of variants) byProduct.set(v.productId, [...(byProduct.get(v.productId) ?? []), v]);

  const rows: unknown[][] = [];
  for (const p of products.sort((a, b) => a.slug.localeCompare(b.slug))) {
    const base = [
      p.slug,
      p.status,
      p.name.en,
      p.name.tr,
      p.summary.en,
      p.summary.tr,
      p.description.en,
      p.description.tr,
      brandMap.get(p.brandId)?.slug ?? "",
      catMap.get(p.categoryId)?.slug ?? "",
      p.partNumber,
      p.oemNumbers.join("|"),
      p.tags.join("|"),
      p.warrantyMonths,
      p.fitment,
      p.isFeatured ? "true" : "false",
    ];
    const vs = (byProduct.get(p.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder);
    if (vs.length === 0) rows.push([...base, "", "", "", "", "", "", "", "", "", "", "", ""]);
    for (const v of vs) {
      rows.push([
        ...base,
        v.sku,
        v.name.en,
        v.name.tr,
        minorToMajorString(v.price),
        v.compareAtPrice !== undefined ? minorToMajorString(v.compareAtPrice) : "",
        v.cost !== undefined ? minorToMajorString(v.cost) : "",
        v.stockOnHand,
        v.lowStockThreshold,
        v.weightGrams,
        v.barcode ?? "",
        v.isActive ? "true" : "false",
        v.isDefault ? "true" : "false",
      ]);
    }
  }
  // columns 13 (warranty), 19.. numerics are written unquoted; text columns are formula-guarded
  const numeric = new Set([13, 19, 20, 21, 22, 23, 24]);
  return toCsv(PRODUCT_CSV_COLUMNS, rows, numeric);
}

/* ------------------------------------------------------------------ import */

class DryRunRollback extends Error {}

type Rec = Record<string, string>;

const truthy = (v: string | undefined, fallback: boolean): boolean => {
  if (v === undefined || v === "") return fallback;
  return ["true", "1", "yes", "y", "evet"].includes(v.trim().toLowerCase());
};
const list = (v: string | undefined): string[] => (v ? v.split("|").map((s) => s.trim()).filter(Boolean) : []);
const intOrNaN = (v: string | undefined): number => (v === undefined || v === "" ? NaN : /^-?\d+$/.test(v.trim()) ? Number(v) : NaN);

function describeError(e: unknown): string {
  if (isDomainError(e)) {
    const fields = e.fieldErrors ? ` (${Object.entries(e.fieldErrors).map(([k, v]) => `${k}: ${v.join("/")}`).join(", ")})` : "";
    return `${e.code}${fields}`;
  }
  return "unexpected_error";
}

export async function importProductsCsv(csv: string, actor: Actor, opts: { dryRun?: boolean } = {}): Promise<CsvImportReport> {
  if (Buffer.byteLength(csv, "utf8") > MAX_IMPORT_BYTES) throw new DomainError("file_too_large", { status: 413 });
  let parsed: ReturnType<typeof parseCsvRecords>;
  try {
    parsed = parseCsvRecords(csv, 5000);
  } catch (e) {
    if (e instanceof CsvParseError) throw new DomainError("csv_invalid", { status: 400 });
    throw e;
  }
  const { header, records } = parsed;
  if (!header.includes("sku") || !header.includes("price")) throw new DomainError("csv_invalid", { status: 400 });

  const report: CsvImportReport = { created: 0, updated: 0, skipped: 0, errors: [] };
  const fail = (row: number, message: string) => {
    report.errors.push({ row, message });
    report.skipped++;
  };

  // Group data rows by product (slug, else slugified English name, else part number).
  const groups = new Map<string, { row: number; rec: Rec }[]>();
  records.forEach((rec, idx) => {
    const key = rec.slug || slugify(rec.name_en ?? "") || slugify(rec.part_number ?? "");
    const rowNumber = idx + 2;
    if (!key) return fail(rowNumber, "missing_product_identity");
    if (!rec.sku) return fail(rowNumber, "missing_sku");
    groups.set(key, [...(groups.get(key) ?? []), { row: rowNumber, rec }]);
  });

  const run = async () => {
    const [brands, categories] = await Promise.all([db.brands.all(), db.categories.all()]);
    const brandBySlug = new Map(brands.flatMap((b) => [[b.slug, b.id] as const, [b.name.toLowerCase(), b.id] as const]));
    const catBySlug = new Map(categories.map((c) => [c.slug, c.id] as const));

    for (const [slug, rows] of groups) {
      const first = rows[0] as { row: number; rec: Rec };
      try {
        await db.transaction(async () => {
          const existing = await db.products.findOne((p) => p.slug === slug);
          const rec = first.rec;

          const brandId = rec.brand ? brandBySlug.get(rec.brand.toLowerCase()) : undefined;
          const categoryId = rec.category ? catBySlug.get(rec.category.toLowerCase()) : undefined;
          if (rec.brand && !brandId) throw new DomainError("validation_failed", { fieldErrors: { brand: ["invalid_value"] } });
          if (rec.category && !categoryId) throw new DomainError("validation_failed", { fieldErrors: { category: ["invalid_value"] } });

          const warranty = intOrNaN(rec.warranty_months);
          const patch: Partial<ProductInput> = {};
          if (rec.name_en) patch.name = { en: rec.name_en, tr: rec.name_tr ?? "" };
          if (rec.summary_en) patch.summary = { en: rec.summary_en, tr: rec.summary_tr ?? "" };
          if (rec.description_en || rec.description_tr) patch.description = { en: rec.description_en ?? "", tr: rec.description_tr ?? "" };
          if (brandId) patch.brandId = brandId;
          if (categoryId) patch.categoryId = categoryId;
          if (rec.part_number) patch.partNumber = rec.part_number;
          if (rec.oem_numbers) patch.oemNumbers = list(rec.oem_numbers);
          if (rec.tags) patch.tags = list(rec.tags);
          if (!Number.isNaN(warranty)) patch.warrantyMonths = warranty;
          if (rec.fitment === "universal" || rec.fitment === "specific") patch.fitment = rec.fitment;
          if (rec.status === "draft" || rec.status === "active" || rec.status === "archived") patch.status = rec.status;
          if (rec.featured) patch.isFeatured = truthy(rec.featured, false);

          let product: Product;
          if (existing) {
            product = Object.keys(patch).length ? await updateProduct(existing.id, patch, actor) : existing;
            report.updated++;
          } else {
            const missing = (["name", "summary", "brandId", "categoryId", "partNumber"] as const).filter((k) => patch[k] === undefined);
            if (missing.length) {
              throw new DomainError("validation_failed", { fieldErrors: Object.fromEntries(missing.map((k) => [k, ["required"]])) });
            }
            product = await createProduct(
              {
                slug,
                name: patch.name as ProductInput["name"],
                summary: patch.summary as ProductInput["summary"],
                description: patch.description ?? { en: "", tr: "" },
                brandId: patch.brandId as string,
                categoryId: patch.categoryId as string,
                specs: [],
                tags: patch.tags ?? [],
                status: patch.status ?? "draft",
                isFeatured: patch.isFeatured ?? false,
                partNumber: patch.partNumber as string,
                oemNumbers: patch.oemNumbers ?? [],
                warrantyMonths: patch.warrantyMonths ?? 12,
                fitment: patch.fitment ?? "universal",
              },
              actor,
            );
            report.created++;
          }

          for (const { row, rec: r } of rows) {
            try {
              await db.transaction(async () => {
                const price = parseMajorToMinor(r.price ?? "");
                if (Number.isNaN(price)) throw new DomainError("validation_failed", { fieldErrors: { price: ["number_invalid"] } });
                const compare = r.compare_at_price ? parseMajorToMinor(r.compare_at_price) : undefined;
                const cost = r.cost ? parseMajorToMinor(r.cost) : undefined;
                if ((compare !== undefined && Number.isNaN(compare)) || (cost !== undefined && Number.isNaN(cost))) {
                  throw new DomainError("validation_failed", { fieldErrors: { compare_at_price: ["number_invalid"] } });
                }
                const stock = intOrNaN(r.stock);
                const low = intOrNaN(r.low_stock_threshold);
                const weight = intOrNaN(r.weight_grams);
                const variantExisting = await db.variants.findOne((v) => v.sku.toLowerCase() === r.sku.toLowerCase());
                if (variantExisting && variantExisting.productId !== product.id) throw new DomainError("sku_taken", { status: 409 });

                const input: VariantInput = {
                  sku: r.sku,
                  name: { en: r.variant_name_en || variantExisting?.name.en || "Standard", tr: r.variant_name_tr || variantExisting?.name.tr || "" },
                  options: variantExisting?.options ?? [],
                  price,
                  compareAtPrice: compare && compare > 0 ? compare : undefined,
                  cost,
                  initialStock: Number.isNaN(stock) ? 0 : stock,
                  lowStockThreshold: Number.isNaN(low) ? (variantExisting?.lowStockThreshold ?? 5) : low,
                  weightGrams: Number.isNaN(weight) ? (variantExisting?.weightGrams ?? 0) : weight,
                  barcode: r.barcode || undefined,
                  isActive: truthy(r.variant_active, variantExisting?.isActive ?? true),
                  isDefault: truthy(r.variant_default, variantExisting?.isDefault ?? false),
                };
                if (variantExisting) {
                  await updateVariant(variantExisting.id, input, actor);
                  if (!Number.isNaN(stock) && stock !== variantExisting.stockOnHand) await setStock(variantExisting.id, stock, "CSV import", actor);
                } else {
                  await createVariant(product.id, input, actor);
                }
              });
            } catch (e) {
              if (e instanceof DryRunRollback) throw e;
              fail(row, describeError(e));
            }
          }
        });
      } catch (e) {
        if (e instanceof DryRunRollback) throw e;
        // product-level failure: the whole group was rolled back by the savepoint
        for (const { row } of rows) fail(row, describeError(e));
      }
    }
  };

  try {
    await db.transaction(async () => {
      await run();
      if (opts.dryRun) throw new DryRunRollback();
    });
  } catch (e) {
    if (!(e instanceof DryRunRollback)) throw e;
  }

  if (!opts.dryRun && (report.created > 0 || report.updated > 0)) {
    await logAudit({
      actor,
      action: "product.import",
      entityType: "product",
      entityId: "csv",
      summary: `CSV import: ${report.created} created, ${report.updated} updated, ${report.skipped} skipped`,
    });
  }
  return report;
}

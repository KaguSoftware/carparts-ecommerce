import "server-only";
import { z } from "zod";
import { zodFieldErrors } from "@/lib/action-result";
import { db } from "@/lib/db";
import { DomainError, notFound } from "@/lib/errors";
import { allocate, applyBps } from "@/lib/money";
import type { Actor, Cents, Id, TaxRate } from "@/lib/types/domain";
import type { TaxRateInput } from "./contracts";
import { logAudit } from "./audit";
import { diffFields, nowIso } from "./_shared";

const localized = z.object({ en: z.string().trim().min(1, "required").max(120, "too_long"), tr: z.string().trim().max(120, "too_long") });

const taxRateSchema = z.object({
  name: localized,
  country: z.string().trim().length(2, "country_invalid").toUpperCase(),
  region: z.string().trim().max(80, "too_long"),
  rateBps: z.number({ error: "number_invalid" }).int("integer_required").min(0, "must_not_be_negative").max(10_000, "too_large"),
  appliesToShipping: z.boolean(),
  isActive: z.boolean(),
});

function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new DomainError("validation_failed", { fieldErrors: zodFieldErrors(parsed.error) });
  return parsed.data;
}

/** Pure matching used by checkout and tests: most specific rate wins (region over country). */
export function matchTaxRate(rates: TaxRate[], country: string, region: string): TaxRate | undefined {
  const c = country.trim().toUpperCase();
  const r = region.trim().toLowerCase();
  const active = rates.filter((x) => x.isActive && x.country.toUpperCase() === c);
  return (r ? active.find((x) => x.region.trim() !== "" && x.region.trim().toLowerCase() === r) : undefined) ?? active.find((x) => x.region.trim() === "");
}

export async function calculateTax(input: { country: string; region: string; taxableSubtotal: Cents; shipping: Cents }): Promise<{ tax: Cents; rate?: TaxRate }> {
  const rates = await db.taxRates.find({ where: (x) => x.isActive });
  const rate = matchTaxRate(rates, input.country, input.region ?? "");
  if (!rate) return { tax: 0 };
  const base = Math.max(0, input.taxableSubtotal) + (rate.appliesToShipping ? Math.max(0, input.shipping) : 0);
  return { tax: applyBps(base, rate.rateBps), rate };
}

/** Split an order-level tax amount across lines proportionally (largest remainder, no lost cents). */
export function allocateTax(lineAmounts: Cents[], totalTax: Cents): number[] {
  return allocate(totalTax, lineAmounts);
}

export async function listTaxRates(): Promise<TaxRate[]> {
  return db.taxRates.find({ orderBy: [{ field: "country", direction: "asc" }, { field: "region", direction: "asc" }] });
}

export async function createTaxRate(input: TaxRateInput, actor: Actor): Promise<TaxRate> {
  const data = parse(taxRateSchema, input);
  return db.transaction(async () => {
    const dup = await db.taxRates.findOne((x) => x.country === data.country && x.region.toLowerCase() === data.region.toLowerCase());
    if (dup) throw new DomainError("conflict", { status: 409 });
    const at = nowIso();
    const rate = await db.taxRates.insert({ ...data, createdAt: at, updatedAt: at });
    await logAudit({ actor, action: "tax.create", entityType: "taxRate", entityId: rate.id, summary: `Created tax rate ${rate.name.en} (${rate.rateBps} bps)` });
    return rate;
  });
}

export async function updateTaxRate(id: Id, input: Partial<TaxRateInput>, actor: Actor): Promise<TaxRate> {
  const patch = parse(taxRateSchema.partial(), input);
  return db.transaction(async () => {
    const current = await db.taxRates.get(id);
    if (!current) throw notFound("tax rate");
    const merged = { ...current, ...patch };
    const dup = await db.taxRates.findOne((x) => x.id !== id && x.country === merged.country && x.region.toLowerCase() === merged.region.toLowerCase());
    if (dup) throw new DomainError("conflict", { status: 409 });
    const saved = await db.taxRates.update(id, { ...patch, updatedAt: nowIso() });
    await logAudit({
      actor,
      action: "tax.update",
      entityType: "taxRate",
      entityId: id,
      summary: `Updated tax rate ${saved.name.en}`,
      changes: diffFields(current, saved, ["rateBps", "country", "region", "appliesToShipping", "isActive", "name"]),
    });
    return saved;
  });
}

export async function deleteTaxRate(id: Id, actor: Actor): Promise<void> {
  await db.transaction(async () => {
    const current = await db.taxRates.get(id);
    if (!current) throw notFound("tax rate");
    await db.taxRates.delete(id);
    await logAudit({ actor, action: "tax.delete", entityType: "taxRate", entityId: id, summary: `Deleted tax rate ${current.name.en}` });
  });
}

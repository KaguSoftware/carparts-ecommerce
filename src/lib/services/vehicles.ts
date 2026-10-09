import "server-only";
import { z } from "zod";
import { zodFieldErrors } from "@/lib/action-result";
import { db } from "@/lib/db";
import { DomainError, notFound } from "@/lib/errors";
import type { Actor, FitmentResult, FitmentRow, Id, LocalizedString, Paged, PageParams, Vehicle, VehicleMake, VehicleModel, VehicleSelection, VehicleView } from "@/lib/types/domain";
import { slugify } from "@/lib/utils";
import type { VehicleInput } from "./contracts";
import { logAudit } from "./audit";
import { paginate, uniqueIds } from "./_shared";

/* ------------------------------------------------------------------ views */

export function vehicleLabel(v: Pick<Vehicle, "year" | "engine">, make: VehicleMake, model: VehicleModel): string {
  return `${v.year} ${make.name} ${model.name} ${v.engine}`.trim();
}

async function loadRefs() {
  const [makes, models] = await Promise.all([db.vehicleMakes.all(), db.vehicleModels.all()]);
  return { makes: new Map(makes.map((m) => [m.id, m])), models: new Map(models.map((m) => [m.id, m])) };
}

type Refs = Awaited<ReturnType<typeof loadRefs>>;

function toView(v: Vehicle, refs: Refs): VehicleView | null {
  const make = refs.makes.get(v.makeId);
  const model = refs.models.get(v.modelId);
  if (!make || !model) return null;
  return { ...v, make, model, label: vehicleLabel(v, make, model) };
}

/* ------------------------------------------------------------------ lookups */

export async function listMakes(): Promise<VehicleMake[]> {
  const makes = await db.vehicleMakes.all();
  return makes.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listModels(makeId: Id): Promise<VehicleModel[]> {
  const models = await db.vehicleModels.find({ where: (m) => m.makeId === makeId });
  return models.sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
}

export async function listYears(modelId: Id): Promise<number[]> {
  const rows = await db.vehicles.find({ where: (v) => v.modelId === modelId });
  return [...new Set(rows.map((v) => v.year))].sort((a, b) => b - a);
}

export async function listEngines(modelId: Id, year: number): Promise<VehicleView[]> {
  const [rows, refs] = await Promise.all([db.vehicles.find({ where: (v) => v.modelId === modelId && v.year === year }), loadRefs()]);
  return rows
    .map((v) => toView(v, refs))
    .filter((v): v is VehicleView => v !== null)
    .sort((a, b) => a.engine.localeCompare(b.engine, "en", { numeric: true }));
}

export async function getVehicle(id: Id): Promise<VehicleView | null> {
  const v = await db.vehicles.get(id);
  if (!v) return null;
  return toView(v, await loadRefs());
}

export function selectionIsEmpty(s: VehicleSelection | undefined | null): boolean {
  return !s || (!s.vehicleId && !s.makeId && !s.modelId && s.year === undefined);
}

export async function resolveSelection(selection: VehicleSelection): Promise<Id[]> {
  if (selectionIsEmpty(selection)) return [];
  if (selection.vehicleId) {
    const v = await db.vehicles.get(selection.vehicleId);
    return v ? [v.id] : [];
  }
  const rows = await db.vehicles.find({
    where: (v) =>
      (!selection.makeId || v.makeId === selection.makeId) &&
      (!selection.modelId || v.modelId === selection.modelId) &&
      (selection.year === undefined || v.year === selection.year),
  });
  return rows.map((v) => v.id);
}

export async function describeSelection(selection: VehicleSelection): Promise<string | null> {
  if (selectionIsEmpty(selection)) return null;
  if (selection.vehicleId) return (await getVehicle(selection.vehicleId))?.label ?? null;
  const refs = await loadRefs();
  const make = selection.makeId ? refs.makes.get(selection.makeId) : undefined;
  const model = selection.modelId ? refs.models.get(selection.modelId) : undefined;
  if (selection.makeId && !make) return null;
  if (selection.modelId && !model) return null;
  const parts = [selection.year !== undefined ? String(selection.year) : "", make?.name ?? "", model?.name ?? ""].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

/* ------------------------------------------------------------------ fitment */

export async function checkFitment(productId: Id, selection: VehicleSelection): Promise<FitmentResult> {
  const product = await db.products.get(productId);
  if (!product) throw notFound("product");
  if (product.fitment === "universal") return { status: "universal" };
  const ids = await resolveSelection(selection);
  if (ids.length === 0) return { status: "unknown" };
  const idSet = new Set(ids);
  const rows = await db.fitment.find({ where: (f) => f.productId === productId && idSet.has(f.vehicleId) });
  if (rows.length === 0) return { status: "does_not_fit" };
  const note = ids.length === 1 || rows.length === 1 ? rows[0]?.note : undefined;
  return note ? { status: "fits", note } : { status: "fits" };
}

export async function getFitmentSummary(productId: Id): Promise<{ make: string; models: { model: string; years: number[]; engines: string[] }[] }[]> {
  const [rows, refs] = await Promise.all([db.fitment.find({ where: (f) => f.productId === productId }), loadRefs()]);
  const vehicles = await db.vehicles.getMany(rows.map((r) => r.vehicleId));
  const tree = new Map<string, Map<string, { years: Set<number>; engines: Set<string> }>>();
  for (const v of vehicles) {
    const make = refs.makes.get(v.makeId);
    const model = refs.models.get(v.modelId);
    if (!make || !model) continue;
    const models = tree.get(make.name) ?? new Map();
    const entry = models.get(model.name) ?? { years: new Set<number>(), engines: new Set<string>() };
    entry.years.add(v.year);
    entry.engines.add(v.engine);
    models.set(model.name, entry);
    tree.set(make.name, models);
  }
  return [...tree.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([make, models]) => ({
      make,
      models: [...models.entries()]
        .sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))
        .map(([model, e]) => ({ model, years: [...e.years].sort((a, b) => a - b), engines: [...e.engines].sort() })),
    }));
}

export async function listFitment(productId: Id): Promise<(FitmentRow & { vehicle: VehicleView })[]> {
  const [rows, refs] = await Promise.all([db.fitment.find({ where: (f) => f.productId === productId }), loadRefs()]);
  const vehicles = new Map((await db.vehicles.getMany(rows.map((r) => r.vehicleId))).map((v) => [v.id, v]));
  const out: (FitmentRow & { vehicle: VehicleView })[] = [];
  for (const row of rows) {
    const v = vehicles.get(row.vehicleId);
    const view = v ? toView(v, refs) : null;
    if (view) out.push({ ...row, vehicle: view });
  }
  return out.sort((a, b) => a.vehicle.label.localeCompare(b.vehicle.label, "en", { numeric: true }));
}

const noteSchema = z.object({ en: z.string().trim().max(200, "too_long"), tr: z.string().trim().max(200, "too_long") }).optional();

async function assertVehiclesExist(ids: Id[]) {
  const found = await db.vehicles.getMany(ids);
  if (found.length !== ids.length) throw new DomainError("vehicle_not_found", { status: 404 });
}

async function assertProductExists(productId: Id) {
  const p = await db.products.get(productId);
  if (!p) throw notFound("product");
  return p;
}

export async function setFitment(productId: Id, rows: { vehicleId: Id; note?: LocalizedString }[], actor: Actor): Promise<void> {
  await db.transaction(async () => {
    const product = await assertProductExists(productId);
    const unique = new Map<Id, LocalizedString | undefined>();
    for (const r of rows) {
      const note = noteSchema.safeParse(r.note);
      if (!note.success) throw new DomainError("validation_failed", { fieldErrors: zodFieldErrors(note.error) });
      const cleanNote = note.data && (note.data.en || note.data.tr) ? note.data : undefined;
      // a repeated vehicle keeps the earlier note unless the later entry brings its own
      unique.set(r.vehicleId, cleanNote ?? unique.get(r.vehicleId));
    }
    await assertVehiclesExist([...unique.keys()]);
    const before = await db.fitment.count((f) => f.productId === productId);
    await db.fitment.deleteWhere((f) => f.productId === productId);
    for (const [vehicleId, note] of unique) await db.fitment.insert({ productId, vehicleId, ...(note ? { note } : {}) });
    await logAudit({
      actor,
      action: "fitment.set",
      entityType: "product",
      entityId: productId,
      summary: `Set fitment for ${product.name.en}: ${unique.size} vehicle(s)`,
      changes: { vehicles: { from: before, to: unique.size } },
    });
  });
}

export async function addFitment(productId: Id, vehicleIds: Id[], actor: Actor): Promise<void> {
  await db.transaction(async () => {
    const product = await assertProductExists(productId);
    const ids = uniqueIds(vehicleIds);
    await assertVehiclesExist(ids);
    const existing = new Set((await db.fitment.find({ where: (f) => f.productId === productId })).map((f) => f.vehicleId));
    let added = 0;
    for (const vehicleId of ids) {
      if (existing.has(vehicleId)) continue;
      await db.fitment.insert({ productId, vehicleId });
      added++;
    }
    if (added) await logAudit({ actor, action: "fitment.add", entityType: "product", entityId: productId, summary: `Added ${added} vehicle(s) to ${product.name.en}` });
  });
}

export async function removeFitment(productId: Id, vehicleIds: Id[], actor: Actor): Promise<void> {
  await db.transaction(async () => {
    const product = await assertProductExists(productId);
    const ids = new Set(vehicleIds);
    const removed = await db.fitment.deleteWhere((f) => f.productId === productId && ids.has(f.vehicleId));
    if (removed) await logAudit({ actor, action: "fitment.remove", entityType: "product", entityId: productId, summary: `Removed ${removed} vehicle(s) from ${product.name.en}` });
  });
}

/* ------------------------------------------------------------------ vehicle admin */

export async function listAllVehicles(filter: PageParams & { makeId?: Id; modelId?: Id; q?: string } = {}): Promise<Paged<VehicleView>> {
  const refs = await loadRefs();
  const q = filter.q?.trim().toLowerCase();
  const rows = await db.vehicles.find({ where: (v) => (!filter.makeId || v.makeId === filter.makeId) && (!filter.modelId || v.modelId === filter.modelId) });
  const views = rows
    .map((v) => toView(v, refs))
    .filter((v): v is VehicleView => v !== null && (!q || v.label.toLowerCase().includes(q)))
    .sort((a, b) => a.make.name.localeCompare(b.make.name) || a.model.name.localeCompare(b.model.name, "en", { numeric: true }) || b.year - a.year || a.engine.localeCompare(b.engine));
  return paginate(views, filter, 50);
}

const nameSchema = z.string().trim().min(1, "required").max(60, "too_long");
const vehicleSchema = z.object({
  makeId: z.string().min(1, "required"),
  modelId: z.string().min(1, "required"),
  year: z.number({ error: "number_invalid" }).int("integer_required").min(1950, "invalid_value").max(new Date().getFullYear() + 2, "invalid_value"),
  engine: z.string().trim().min(1, "required").max(80, "too_long"),
  fuel: z.enum(["petrol", "diesel", "hybrid", "electric", "lpg"]),
  bodyType: z.string().trim().max(40, "too_long").optional(),
});

function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new DomainError("validation_failed", { fieldErrors: zodFieldErrors(parsed.error) });
  return parsed.data;
}

export async function createMake(name: string, actor: Actor): Promise<VehicleMake> {
  const clean = parse(nameSchema, name);
  return db.transaction(async () => {
    const slug = slugify(clean);
    if (!slug) throw new DomainError("validation_failed", { fieldErrors: { name: ["invalid_value"] } });
    if (await db.vehicleMakes.findOne((m) => m.slug === slug || m.name.toLowerCase() === clean.toLowerCase())) throw new DomainError("slug_taken", { status: 409 });
    const make = await db.vehicleMakes.insert({ name: clean, slug });
    await logAudit({ actor, action: "vehicle.make_create", entityType: "vehicleMake", entityId: make.id, summary: `Created make ${make.name}` });
    return make;
  });
}

export async function createModel(makeId: Id, name: string, actor: Actor): Promise<VehicleModel> {
  const clean = parse(nameSchema, name);
  return db.transaction(async () => {
    const make = await db.vehicleMakes.get(makeId);
    if (!make) throw new DomainError("vehicle_not_found", { status: 404 });
    const slug = slugify(clean);
    if (!slug) throw new DomainError("validation_failed", { fieldErrors: { name: ["invalid_value"] } });
    if (await db.vehicleModels.findOne((m) => m.makeId === makeId && (m.slug === slug || m.name.toLowerCase() === clean.toLowerCase()))) throw new DomainError("slug_taken", { status: 409 });
    const model = await db.vehicleModels.insert({ makeId, name: clean, slug });
    await logAudit({ actor, action: "vehicle.model_create", entityType: "vehicleModel", entityId: model.id, summary: `Created model ${make.name} ${model.name}` });
    return model;
  });
}

async function assertModelBelongsToMake(makeId: Id, modelId: Id) {
  const [make, model] = await Promise.all([db.vehicleMakes.get(makeId), db.vehicleModels.get(modelId)]);
  if (!make || !model || model.makeId !== makeId) throw new DomainError("vehicle_not_found", { status: 404 });
}

export async function createVehicle(input: VehicleInput, actor: Actor): Promise<Vehicle> {
  const data = parse(vehicleSchema, input);
  return db.transaction(async () => {
    await assertModelBelongsToMake(data.makeId, data.modelId);
    const dup = await db.vehicles.findOne((v) => v.modelId === data.modelId && v.year === data.year && v.engine.toLowerCase() === data.engine.toLowerCase());
    if (dup) throw new DomainError("conflict", { status: 409 });
    const vehicle = await db.vehicles.insert(data as Omit<Vehicle, "id">);
    const view = toView(vehicle, await loadRefs());
    await logAudit({ actor, action: "vehicle.create", entityType: "vehicle", entityId: vehicle.id, summary: `Created vehicle ${view?.label ?? vehicle.id}` });
    return vehicle;
  });
}

export async function updateVehicle(id: Id, input: Partial<VehicleInput>, actor: Actor): Promise<Vehicle> {
  return db.transaction(async () => {
    const current = await db.vehicles.get(id);
    if (!current) throw new DomainError("vehicle_not_found", { status: 404 });
    const { id: _id, ...editable } = current;
    void _id;
    const merged = parse(vehicleSchema, { ...editable, ...input });
    await assertModelBelongsToMake(merged.makeId, merged.modelId);
    const dup = await db.vehicles.findOne((v) => v.id !== id && v.modelId === merged.modelId && v.year === merged.year && v.engine.toLowerCase() === merged.engine.toLowerCase());
    if (dup) throw new DomainError("conflict", { status: 409 });
    const saved = await db.vehicles.update(id, merged);
    await logAudit({ actor, action: "vehicle.update", entityType: "vehicle", entityId: id, summary: `Updated vehicle ${id}` });
    return saved;
  });
}

export async function deleteVehicle(id: Id, actor: Actor): Promise<void> {
  await db.transaction(async () => {
    const current = await db.vehicles.get(id);
    if (!current) throw new DomainError("vehicle_not_found", { status: 404 });
    const fitmentRows = await db.fitment.deleteWhere((f) => f.vehicleId === id);
    await db.vehicles.delete(id);
    await logAudit({ actor, action: "vehicle.delete", entityType: "vehicle", entityId: id, summary: `Deleted vehicle ${id} (${fitmentRows} fitment row(s))` });
  });
}

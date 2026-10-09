import { freshSeed, STAFF } from "../helpers/test-env";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import * as vehicles from "@/lib/services/vehicles";

beforeAll(async () => {
  await freshSeed();
}, 60_000);

async function aSpecificProduct() {
  return (await db.products.find({ where: (p) => p.fitment === "specific" && p.status === "active" }))[0]!;
}

describe("make -> model -> year -> engine cascade", () => {
  it("lists makes alphabetically, then models, years (newest first) and engines", async () => {
    const makes = await vehicles.listMakes();
    expect(makes.length).toBeGreaterThan(5);
    expect(makes.map((m) => m.name)).toEqual([...makes.map((m) => m.name)].sort((a, b) => a.localeCompare(b)));
    const make = makes[0]!;
    const models = await vehicles.listModels(make.id);
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((m) => m.makeId === make.id)).toBe(true);
    const model = models[0]!;
    const years = await vehicles.listYears(model.id);
    expect(years).toEqual([...years].sort((a, b) => b - a));
    expect(new Set(years).size).toBe(years.length);
    const engines = await vehicles.listEngines(model.id, years[0]!);
    expect(engines.length).toBeGreaterThan(0);
    expect(engines[0]!.label).toBe(`${years[0]} ${make.name} ${model.name} ${engines[0]!.engine}`);
    expect(await vehicles.listEngines(model.id, 1900)).toEqual([]);
    expect(await vehicles.listModels("mak_missing")).toEqual([]);
  });

  it("describes full and partial selections", async () => {
    const make = (await vehicles.listMakes())[0]!;
    const model = (await vehicles.listModels(make.id))[0]!;
    const year = (await vehicles.listYears(model.id))[0]!;
    const engine = (await vehicles.listEngines(model.id, year))[0]!;
    expect(await vehicles.describeSelection({ vehicleId: engine.id })).toBe(engine.label);
    expect(await vehicles.describeSelection({ makeId: make.id })).toBe(make.name);
    expect(await vehicles.describeSelection({ makeId: make.id, modelId: model.id, year })).toBe(`${year} ${make.name} ${model.name}`);
    expect(await vehicles.describeSelection({})).toBeNull();
    expect(await vehicles.describeSelection({ makeId: "mak_missing" })).toBeNull();
    expect(await vehicles.describeSelection({ vehicleId: "veh_missing" })).toBeNull();
  });

  it("resolves partial selections to every matching configuration", async () => {
    const make = (await vehicles.listMakes())[0]!;
    const model = (await vehicles.listModels(make.id))[0]!;
    const byMake = await vehicles.resolveSelection({ makeId: make.id });
    const byModel = await vehicles.resolveSelection({ makeId: make.id, modelId: model.id });
    expect(byModel.length).toBeGreaterThan(0);
    expect(byMake.length).toBeGreaterThanOrEqual(byModel.length);
    const year = (await vehicles.listYears(model.id))[0]!;
    const byYear = await vehicles.resolveSelection({ modelId: model.id, year });
    expect(byYear.length).toBeLessThanOrEqual(byModel.length);
    expect(await vehicles.resolveSelection({})).toEqual([]);
    expect(await vehicles.resolveSelection({ vehicleId: "veh_missing" })).toEqual([]);
  });
});

describe("fitment checks", () => {
  it("answers fits / does_not_fit / universal / unknown", async () => {
    const product = await aSpecificProduct();
    const fitRows = await db.fitment.find({ where: (f) => f.productId === product.id });
    expect(fitRows.length).toBeGreaterThan(0);
    const fitting = fitRows[0]!.vehicleId;
    expect((await vehicles.checkFitment(product.id, { vehicleId: fitting })).status).toBe("fits");

    const fitSet = new Set(fitRows.map((f) => f.vehicleId));
    const stranger = (await db.vehicles.find({ where: (v) => !fitSet.has(v.id) }))[0]!;
    expect(await vehicles.checkFitment(product.id, { vehicleId: stranger.id })).toEqual({ status: "does_not_fit" });

    expect(await vehicles.checkFitment(product.id, {})).toEqual({ status: "unknown" });
    expect(await vehicles.checkFitment(product.id, { vehicleId: "veh_missing" })).toEqual({ status: "unknown" });

    const universal = (await db.products.findOne((p) => p.fitment === "universal"))!;
    expect(await vehicles.checkFitment(universal.id, { vehicleId: stranger.id })).toEqual({ status: "universal" });
    await expect(vehicles.checkFitment("prd_missing", { vehicleId: fitting })).rejects.toMatchObject({ code: "not_found" });
  });

  it("a partial selection fits when ANY matching configuration fits", async () => {
    const product = await aSpecificProduct();
    const row = (await db.fitment.findOne((f) => f.productId === product.id))!;
    const v = (await db.vehicles.get(row.vehicleId))!;
    expect((await vehicles.checkFitment(product.id, { makeId: v.makeId })).status).toBe("fits");
    expect((await vehicles.checkFitment(product.id, { makeId: v.makeId, modelId: v.modelId, year: v.year })).status).toBe("fits");
  });

  it("summarises the fit list grouped make -> model with sorted years", async () => {
    const product = await aSpecificProduct();
    const summary = await vehicles.getFitmentSummary(product.id);
    expect(summary.length).toBeGreaterThan(0);
    for (const make of summary) {
      expect(make.models.length).toBeGreaterThan(0);
      for (const m of make.models) expect(m.years).toEqual([...m.years].sort((a, b) => a - b));
    }
    expect(await vehicles.getFitmentSummary((await db.products.findOne((p) => p.fitment === "universal"))!.id)).toEqual([]);
  });
});

describe("fitment + vehicle administration", () => {
  it("sets, adds and removes fitment rows with validation", async () => {
    const product = await aSpecificProduct();
    const [a, b, c] = await db.vehicles.find({ limit: 3 });
    await vehicles.setFitment(product.id, [{ vehicleId: a!.id, note: { en: "Front axle only", tr: "Sadece ön aks" } }, { vehicleId: a!.id }, { vehicleId: b!.id }], STAFF);
    let rows = await vehicles.listFitment(product.id);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.vehicleId === a!.id)).toMatchObject({ note: { en: "Front axle only" } });
    expect(await vehicles.checkFitment(product.id, { vehicleId: a!.id })).toMatchObject({ status: "fits", note: { en: "Front axle only" } });

    await vehicles.addFitment(product.id, [b!.id, c!.id], STAFF); // b already present
    rows = await vehicles.listFitment(product.id);
    expect(rows.map((r) => r.vehicleId).sort()).toEqual([a!.id, b!.id, c!.id].sort());
    await vehicles.removeFitment(product.id, [a!.id, "veh_missing"], STAFF);
    expect((await vehicles.listFitment(product.id)).map((r) => r.vehicleId).sort()).toEqual([b!.id, c!.id].sort());

    await expect(vehicles.setFitment(product.id, [{ vehicleId: "veh_missing" }], STAFF)).rejects.toMatchObject({ code: "vehicle_not_found" });
    await expect(vehicles.addFitment("prd_missing", [a!.id], STAFF)).rejects.toMatchObject({ code: "not_found" });
    expect((await vehicles.listFitment(product.id)).length).toBe(2); // failed calls changed nothing
  });

  it("manages makes, models and vehicles; deleting a vehicle removes its fitment", async () => {
    const make = await vehicles.createMake("Zeta Motors", STAFF);
    expect(make.slug).toBe("zeta-motors");
    await expect(vehicles.createMake("zeta motors", STAFF)).rejects.toMatchObject({ code: "slug_taken" });
    const model = await vehicles.createModel(make.id, "Comet", STAFF);
    await expect(vehicles.createModel("mak_missing", "X", STAFF)).rejects.toMatchObject({ code: "vehicle_not_found" });
    const vehicle = await vehicles.createVehicle({ makeId: make.id, modelId: model.id, year: 2020, engine: "2.0 T 200 hp", fuel: "petrol" }, STAFF);
    await expect(vehicles.createVehicle({ makeId: make.id, modelId: model.id, year: 2020, engine: "2.0 t 200 HP", fuel: "petrol" }, STAFF)).rejects.toMatchObject({ code: "conflict" });
    await expect(vehicles.createVehicle({ makeId: make.id, modelId: "mdl_missing", year: 2020, engine: "x", fuel: "petrol" }, STAFF)).rejects.toMatchObject({ code: "vehicle_not_found" });
    await expect(vehicles.createVehicle({ makeId: make.id, modelId: model.id, year: 1800, engine: "x", fuel: "petrol" }, STAFF)).rejects.toMatchObject({ code: "validation_failed" });

    const updated = await vehicles.updateVehicle(vehicle.id, { engine: "2.0 T 220 hp" }, STAFF);
    expect(updated.engine).toBe("2.0 T 220 hp");
    const view = (await vehicles.getVehicle(vehicle.id))!;
    expect(view.label).toBe("2020 Zeta Motors Comet 2.0 T 220 hp");

    const product = await aSpecificProduct();
    await vehicles.addFitment(product.id, [vehicle.id], STAFF);
    const found = await vehicles.listAllVehicles({ q: "comet" });
    expect(found.items.map((v) => v.id)).toEqual([vehicle.id]);
    expect((await vehicles.listAllVehicles({ makeId: make.id })).total).toBe(1);

    await vehicles.deleteVehicle(vehicle.id, STAFF);
    expect(await vehicles.getVehicle(vehicle.id)).toBeNull();
    expect(await db.fitment.count((f) => f.vehicleId === vehicle.id)).toBe(0);
    await expect(vehicles.deleteVehicle(vehicle.id, STAFF)).rejects.toMatchObject({ code: "vehicle_not_found" });
  });
});

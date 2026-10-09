"use server";

import {
  addFitment,
  createMake,
  createModel,
  createVehicle,
  deleteVehicle,
  listAllVehicles,
  removeFitment,
  setFitment,
  updateVehicle,
} from "@/lib/services/vehicles";
import { adminAction, refresh } from "./_shared";
import {
  createMakeSchema,
  clearFitmentSchema,
  createModelSchema,
  deleteVehicleSchema,
  fitmentIdsSchema,
  fitmentMatchingSchema,
  saveVehicleSchema,
  searchVehiclesSchema,
} from "./vehicles.schema";

export async function createMakeAction(raw: unknown) {
  return adminAction("catalog.write", createMakeSchema, raw, async ({ name }, { actor }) => {
    const make = await createMake(name, actor);
    refresh(["/admin/vehicles"], { store: true });
    return { id: make.id };
  });
}

export async function createModelAction(raw: unknown) {
  return adminAction("catalog.write", createModelSchema, raw, async ({ makeId, name }, { actor }) => {
    const model = await createModel(makeId, name, actor);
    refresh(["/admin/vehicles"], { store: true });
    return { id: model.id };
  });
}

export async function saveVehicleAction(raw: unknown) {
  return adminAction("catalog.write", saveVehicleSchema, raw, async ({ id, vehicle }, { actor }) => {
    const input = { ...vehicle, ...(vehicle.bodyType ? {} : { bodyType: undefined }) };
    const saved = id ? await updateVehicle(id, input, actor) : await createVehicle(input, actor);
    refresh(["/admin/vehicles"], { store: true });
    return { id: saved.id };
  });
}

export async function deleteVehicleAction(raw: unknown) {
  return adminAction("catalog.write", deleteVehicleSchema, raw, async ({ id }, { actor }) => {
    await deleteVehicle(id, actor);
    refresh(["/admin/vehicles"], { store: true });
  });
}

/** Vehicle search for the fitment editor (paged, 25 per page). */
export async function searchVehiclesAction(raw: unknown) {
  return adminAction("catalog.read", searchVehiclesSchema, raw, async ({ q, makeId, modelId, page }) => {
    const result = await listAllVehicles({ page, pageSize: 25, ...(q ? { q } : {}), ...(makeId ? { makeId } : {}), ...(modelId ? { modelId } : {}) });
    return {
      total: result.total,
      page: result.page,
      pageCount: result.pageCount,
      items: result.items.map((v) => ({ id: v.id, label: v.label, engine: v.engine, fuel: v.fuel, year: v.year })),
    };
  });
}

export async function addFitmentAction(raw: unknown) {
  return adminAction("catalog.write", fitmentIdsSchema, raw, async ({ productId, vehicleIds }, { actor }) => {
    await addFitment(productId, vehicleIds, actor);
    refresh([`/admin/products/${productId}`], { store: true });
    return { added: vehicleIds.length };
  });
}

export async function removeFitmentAction(raw: unknown) {
  return adminAction("catalog.write", fitmentIdsSchema, raw, async ({ productId, vehicleIds }, { actor }) => {
    await removeFitment(productId, vehicleIds, actor);
    refresh([`/admin/products/${productId}`], { store: true });
    return { removed: vehicleIds.length };
  });
}

/** Adds every vehicle matching the search filters (e.g. all years of one model) in one go. */
export async function addFitmentMatchingAction(raw: unknown) {
  return adminAction("catalog.write", fitmentMatchingSchema, raw, async ({ productId, q, makeId, modelId }, { actor }) => {
    const ids: string[] = [];
    for (let page = 1; page <= 50; page++) {
      const result = await listAllVehicles({ page, pageSize: 100, ...(q ? { q } : {}), ...(makeId ? { makeId } : {}), ...(modelId ? { modelId } : {}) });
      ids.push(...result.items.map((v) => v.id));
      if (page >= result.pageCount) break;
    }
    if (ids.length > 0) await addFitment(productId, ids, actor);
    refresh([`/admin/products/${productId}`], { store: true });
    return { added: ids.length };
  });
}

/** Removes every fitment row of a product (e.g. before switching it to universal). */
export async function clearFitmentAction(raw: unknown) {
  return adminAction("catalog.write", clearFitmentSchema, raw, async ({ productId }, { actor }) => {
    await setFitment(productId, [], actor);
    refresh([`/admin/products/${productId}`], { store: true });
  });
}

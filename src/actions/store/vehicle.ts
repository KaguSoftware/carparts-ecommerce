"use server";

import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/action-result";
import { DomainError } from "@/lib/errors";
import { describeSelection, getVehicle } from "@/lib/services/vehicles";
import { clearVehicleSelection, setVehicleSelection } from "@/lib/session/cookies";
import type { VehicleSelection } from "@/lib/types/domain";

const selectionSchema = z.strictObject({
  makeId: z.string().min(1, "required").max(64, "too_long"),
  modelId: z.string().min(1).max(64).optional(),
  year: z.number().int().min(1950).max(2100).optional(),
  vehicleId: z.string().min(1).max(64).optional(),
});

/** Saves "My Garage" in the `vehicle` cookie. Only verified selections are stored. */
export async function setVehicleAction(raw: unknown): Promise<ActionResult<{ selection: VehicleSelection; label: string }>> {
  return runAction(selectionSchema, raw, async (input) => {
    let selection: VehicleSelection = { ...input };
    if (input.vehicleId) {
      const vehicle = await getVehicle(input.vehicleId);
      if (!vehicle) throw new DomainError("vehicle_not_found", { status: 404 });
      selection = { makeId: vehicle.makeId, modelId: vehicle.modelId, year: vehicle.year, vehicleId: vehicle.id };
    }
    const label = await describeSelection(selection);
    if (!label) throw new DomainError("vehicle_not_found", { status: 404 });
    await setVehicleSelection(selection);
    return { selection, label };
  });
}

export async function clearVehicleAction(): Promise<ActionResult<void>> {
  return runAction(z.undefined(), undefined, async () => {
    await clearVehicleSelection();
  });
}

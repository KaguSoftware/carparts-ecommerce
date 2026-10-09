import { z } from "zod";
import { assertSameOrigin, handle, json, readJson } from "@/lib/api/respond";
import { DomainError } from "@/lib/errors";
import { clearVehicleSelection, getVehicleSelection, setVehicleSelection } from "@/lib/session/cookies";
import { describeSelection } from "@/lib/services/vehicles";

export const dynamic = "force-dynamic";

const selectionSchema = z.strictObject({
  makeId: z.string().min(1).max(64).optional(),
  modelId: z.string().min(1).max(64).optional(),
  year: z.number().int().min(1950).max(2100).optional(),
  vehicleId: z.string().min(1).max(64).optional(),
});

/** GET -> { selection, label } for the `vehicle` cookie. */
export const GET = handle(async () => {
  const selection = await getVehicleSelection();
  return json({ selection, label: await describeSelection(selection) });
});

/** PUT { makeId?, modelId?, year?, vehicleId? } -> stores a verified selection. */
export const PUT = handle(async (request: Request) => {
  assertSameOrigin(request);
  const selection = await readJson(request, selectionSchema);
  const label = await describeSelection(selection);
  if (!label) throw new DomainError("vehicle_not_found", { status: 404 });
  await setVehicleSelection(selection);
  return json({ selection, label });
});

/** DELETE -> clears the selection. */
export const DELETE = handle(async (request: Request) => {
  assertSameOrigin(request);
  await clearVehicleSelection();
  return json({ selection: {}, label: null });
});

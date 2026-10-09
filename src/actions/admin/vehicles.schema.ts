import { z } from "zod";
import { idSchema } from "@/lib/validation/common";

const name = z.string().trim().min(1, "required").max(60, "too_long");

export const createMakeSchema = z.object({ name });
export const createModelSchema = z.object({ makeId: idSchema, name });

export const vehicleInputSchema = z.object({
  makeId: z.string().min(1, "required"),
  modelId: z.string().min(1, "required"),
  year: z
    .number({ error: "number_invalid" })
    .int("integer_required")
    .min(1950, "invalid_value")
    .max(new Date().getFullYear() + 2, "invalid_value"),
  engine: z.string().trim().min(1, "required").max(80, "too_long"),
  fuel: z.enum(["petrol", "diesel", "hybrid", "electric", "lpg"]),
  bodyType: z.string().trim().max(40, "too_long"),
});
export type VehicleFormInput = z.infer<typeof vehicleInputSchema>;

export const saveVehicleSchema = z.object({ id: z.string().optional(), vehicle: vehicleInputSchema });
export const deleteVehicleSchema = z.object({ id: idSchema });

export const searchVehiclesSchema = z.object({
  q: z.string().trim().max(80).optional(),
  makeId: z.string().max(64).optional(),
  modelId: z.string().max(64).optional(),
  page: z.number().int().min(1).max(10_000).default(1),
});

export const fitmentIdsSchema = z.object({ productId: idSchema, vehicleIds: z.array(idSchema).min(1, "required").max(500, "too_large") });
export const fitmentMatchingSchema = z.object({
  productId: idSchema,
  q: z.string().trim().max(80).optional(),
  makeId: z.string().max(64).optional(),
  modelId: z.string().max(64).optional(),
});

export const clearFitmentSchema = z.object({ productId: idSchema });

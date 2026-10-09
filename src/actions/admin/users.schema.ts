import { z } from "zod";
import { emailSchema, idSchema } from "@/lib/validation/common";

export const userIdSchema = z.object({ id: idSchema });
export const setDisabledSchema = z.object({ id: idSchema, disabled: z.boolean() });
export const setRoleSchema = z.object({ id: idSchema, role: z.enum(["customer", "staff", "admin"]) });
export const createStaffSchema = z.object({
  name: z.string().trim().min(1, "required").max(80, "too_long"),
  email: emailSchema,
  role: z.enum(["staff", "admin"]),
});

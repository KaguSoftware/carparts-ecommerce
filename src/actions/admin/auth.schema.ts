import { z } from "zod";
import { emailSchema, localeSchema } from "@/lib/validation/common";

export const adminSignInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "required").max(128, "too_long"),
  next: z.string().max(300).optional(),
});

export const adminLocaleSchema = localeSchema;

/** Only same-site admin paths are valid post-login targets (blocks open redirects). */
export function safeAdminNext(next: string | undefined): string {
  if (!next || !next.startsWith("/admin") || next.startsWith("//") || next.includes("\\") || next.startsWith("/admin/login")) return "/admin";
  return next;
}

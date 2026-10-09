import { z } from "zod";
import { emailSchema, localeSchema, passwordSchema } from "@/lib/validation/common";

/** Shared by the auth forms (client, via zodResolver) and the Server Actions (authoritative). Messages are validation codes. */

const nameSchema = z.string().trim().min(1, "required").max(80, "too_long");
const nextSchema = z.string().max(300).nullish();
const passwordInput = z.string().min(1, "required").max(128, "too_long");

export const signInSchema = z.object({
  email: emailSchema,
  password: passwordInput,
  next: nextSchema,
  locale: localeSchema,
});
export type SignInInput = z.input<typeof signInSchema>;

export const signUpSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  marketingOptIn: z.boolean().default(false),
  next: nextSchema,
  locale: localeSchema,
});

/** Client-only extras: confirmation field and terms checkbox. */
export const signUpFormSchema = signUpSchema
  .extend({
    confirmPassword: z.string().min(1, "required"),
    acceptTerms: z.boolean().refine((v) => v === true, "terms_required"),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "passwords_mismatch" });

export const forgotPasswordSchema = z.object({ email: emailSchema, locale: localeSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "required").max(256, "too_long"),
  newPassword: passwordSchema,
});

export const resetPasswordFormSchema = z
  .object({ newPassword: passwordSchema, confirmPassword: z.string().min(1, "required") })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "passwords_mismatch" });

export const changePasswordSchema = z.object({
  currentPassword: passwordInput,
  newPassword: passwordSchema,
});

export const changePasswordFormSchema = changePasswordSchema
  .extend({ confirmPassword: z.string().min(1, "required") })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "passwords_mismatch" })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], message: "invalid_value" });

export const localeOnlySchema = z.object({ locale: localeSchema });

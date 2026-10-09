import { z } from "zod";
import { idSchema, localizedStringSchema } from "@/lib/validation/common";

const optionalLoc = (max: number) => z.object({ en: z.string().trim().max(max, "too_long"), tr: z.string().trim().max(max, "too_long") });
const slug = z
  .string()
  .trim()
  .max(96, "too_long")
  .refine((v) => v === "" || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v), "slug_invalid");
const sortOrder = z.number({ error: "number_invalid" }).int("integer_required").min(0, "must_not_be_negative").max(100_000, "too_large");

export const categoryInputSchema = z.object({
  slug,
  /** Empty string = top level. */
  parentId: z.string(),
  name: localizedStringSchema({ max: 100 }),
  description: localizedStringSchema({ required: false, max: 1000 }),
  image: z.string().trim().max(300, "too_long"),
  icon: z.string().trim().max(60, "too_long"),
  sortOrder,
  isActive: z.boolean(),
  seoTitle: optionalLoc(120),
  seoDescription: optionalLoc(300),
});
export type CategoryFormInput = z.infer<typeof categoryInputSchema>;

export const saveCategorySchema = z.object({ id: z.string().optional(), category: categoryInputSchema });

export const brandInputSchema = z.object({
  slug,
  name: z.string().trim().min(1, "required").max(80, "too_long"),
  description: localizedStringSchema({ required: false, max: 1000 }),
  logo: z.string().trim().max(300, "too_long"),
  country: z
    .string()
    .trim()
    .max(2, "country_invalid")
    .refine((v) => v === "" || /^[A-Za-z]{2}$/.test(v), "country_invalid"),
  website: z
    .string()
    .trim()
    .max(300, "too_long")
    .refine((v) => v === "" || /^https?:\/\//i.test(v), "url_invalid"),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  sortOrder,
});
export type BrandFormInput = z.infer<typeof brandInputSchema>;

export const saveBrandSchema = z.object({ id: z.string().optional(), brand: brandInputSchema });
export const deleteByIdSchema = z.object({ id: idSchema });

import { z } from "zod";
import { idSchema, localizedStringSchema } from "@/lib/validation/common";

/**
 * Schemas for catalog admin actions. Messages are validation codes (translated by the UI).
 * The same schemas drive the client forms (react-hook-form + zodResolver) and the Server Actions, which stay authoritative.
 */

const optionalLoc = (max: number) => z.object({ en: z.string().trim().max(max, "too_long"), tr: z.string().trim().max(max, "too_long") });
const intNumber = z.number({ error: "number_invalid" }).int("integer_required");
const cents = intNumber.min(0, "must_not_be_negative").max(1_000_000_000, "too_large");

export const productInputSchema = z.object({
  /** Empty = generate from the English name. */
  slug: z
    .string()
    .trim()
    .max(96, "too_long")
    .refine((v) => v === "" || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v), "slug_invalid"),
  name: localizedStringSchema({ max: 200 }),
  summary: localizedStringSchema({ max: 400 }),
  description: localizedStringSchema({ required: false, max: 20_000 }),
  brandId: z.string().min(1, "required"),
  categoryId: z.string().min(1, "required"),
  /** Extra categories (the primary one is always included by the action). */
  categoryIds: z.array(z.string()).max(20, "too_long"),
  specs: z.array(z.object({ key: localizedStringSchema({ max: 80 }), value: localizedStringSchema({ max: 200 }) })).max(60, "too_long"),
  tags: z.array(z.string().trim().min(1).max(40, "too_long")).max(40, "too_long"),
  status: z.enum(["draft", "active", "archived"]),
  isFeatured: z.boolean(),
  partNumber: z.string().trim().min(1, "required").max(60, "too_long"),
  oemNumbers: z.array(z.string().trim().min(1).max(60, "too_long")).max(30, "too_long"),
  warrantyMonths: intNumber.min(0, "must_not_be_negative").max(240, "too_large"),
  fitment: z.enum(["universal", "specific"]),
  seoTitle: optionalLoc(120),
  seoDescription: optionalLoc(300),
});
export type ProductFormInput = z.infer<typeof productInputSchema>;

export const variantInputSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(2, "required")
    .max(40, "too_long")
    .regex(/^[A-Za-z0-9][A-Za-z0-9._\-/]*$/, "invalid_value"),
  name: localizedStringSchema({ max: 120 }),
  options: z.array(z.object({ name: localizedStringSchema({ max: 60 }), value: localizedStringSchema({ max: 80 }) })).max(8, "too_long"),
  price: intNumber.min(1, "must_be_positive").max(1_000_000_000, "too_large"),
  compareAtPrice: cents.optional(),
  cost: cents.optional(),
  /** Only used when the variant is created; afterwards stock changes go through inventory adjustments. */
  initialStock: intNumber.min(0, "must_not_be_negative").max(10_000_000, "too_large").optional(),
  lowStockThreshold: intNumber.min(0, "must_not_be_negative").max(10_000, "too_large"),
  weightGrams: intNumber.min(0, "must_not_be_negative").max(1_000_000, "too_large"),
  barcode: z.string().trim().max(64, "too_long"),
  imageId: z.string(),
  isActive: z.boolean(),
  isDefault: z.boolean(),
});
export type VariantFormInput = z.infer<typeof variantInputSchema>;

export const createProductSchema = z.object({ product: productInputSchema, variant: variantInputSchema });
export const updateProductSchema = z.object({ id: idSchema, product: productInputSchema });
export const saveVariantSchema = z.object({ productId: idSchema, variantId: z.string().optional(), variant: variantInputSchema });
export const deleteVariantSchema = z.object({ variantId: idSchema });
export const deleteProductSchema = z.object({ id: idSchema });

export const bulkProductsSchema = z.object({
  ids: z.array(idSchema).min(1, "required").max(200, "too_large"),
  op: z.enum(["publish", "draft", "archive", "delete", "feature", "unfeature"]),
});

export const setImagesSchema = z.object({
  productId: idSchema,
  images: z
    .array(
      z.object({
        url: z
          .string()
          .trim()
          .min(1, "required")
          .max(500, "too_long")
          .refine((u) => /^\/(?!\/)/.test(u) || /^https:\/\//i.test(u), "url_invalid"),
        alt: optionalLoc(200),
      }),
    )
    .max(20, "too_long"),
});

export const searchStockSchema = z.object({ q: z.string().trim().max(80).default("") });

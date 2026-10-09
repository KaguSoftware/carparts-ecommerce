import { z } from "zod";
import { idSchema, localizedStringSchema } from "@/lib/validation/common";

const optionalLoc = (max: number) => z.object({ en: z.string().trim().max(max, "too_long"), tr: z.string().trim().max(max, "too_long") });
const dateText = z.string().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "date_invalid");
const sortOrder = z.number({ error: "number_invalid" }).int("integer_required").min(0, "must_not_be_negative").max(10_000, "too_large");

export const bannerInputSchema = z
  .object({
    placement: z.enum(["home_hero", "home_promo", "announcement", "category_top"]),
    title: localizedStringSchema({ max: 120 }),
    subtitle: localizedStringSchema({ required: false, max: 300 }),
    ctaLabel: localizedStringSchema({ required: false, max: 40 }),
    ctaHref: z
      .string()
      .trim()
      .max(300, "too_long")
      .refine((v) => v === "" || /^\/(?!\/)/.test(v) || /^https:\/\//i.test(v), "url_invalid"),
    image: z.string().trim().max(300, "too_long"),
    tone: z.enum(["dark", "orange", "light"]),
    startsAt: dateText,
    endsAt: dateText,
    isActive: z.boolean(),
    sortOrder,
  })
  .refine((v) => !v.startsAt || !v.endsAt || v.endsAt >= v.startsAt, { path: ["endsAt"], message: "date_range_invalid" });
export type BannerFormInput = z.infer<typeof bannerInputSchema>;

export const saveBannerSchema = z.object({ id: z.string().optional(), banner: bannerInputSchema });

export const pageInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "required")
    .max(96, "too_long")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug_invalid"),
  title: localizedStringSchema({ max: 150 }),
  body: localizedStringSchema({ required: false, max: 50_000 }),
  isPublished: z.boolean(),
  showInFooter: z.boolean(),
  sortOrder,
  seoDescription: optionalLoc(300),
});
export type PageFormInput = z.infer<typeof pageInputSchema>;

export const savePageSchema = z.object({ id: z.string().optional(), page: pageInputSchema });
export const deleteByIdSchema = z.object({ id: idSchema });

export const messageUpdateSchema = z.object({
  id: idSchema,
  status: z.enum(["new", "read", "replied", "archived"]).optional(),
  adminNotes: z.string().trim().max(2000, "too_long").optional(),
});
export const subscriberDeleteSchema = z.object({ id: idSchema });

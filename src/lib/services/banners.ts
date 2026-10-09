import "server-only";
import { z } from "zod";
import { zodFieldErrors } from "@/lib/action-result";
import { db } from "@/lib/db";
import { DomainError, notFound } from "@/lib/errors";
import type { Actor, Banner, BannerPlacement, Id } from "@/lib/types/domain";
import type { BannerInput } from "./contracts";
import { logAudit } from "./audit";
import { diffFields, nowIso } from "./_shared";

const loc = (max: number, required: boolean) => {
  const base = z.string().trim().max(max, "too_long");
  return z.object({ en: required ? base.min(1, "required") : base, tr: base });
};
const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "date_invalid");

const bannerSchema = z
  .object({
    placement: z.enum(["home_hero", "home_promo", "announcement", "category_top"]),
    title: loc(120, true),
    subtitle: loc(300, false),
    ctaLabel: loc(40, false),
    ctaHref: z
      .string()
      .trim()
      .max(300, "too_long")
      .refine((v) => v === "" || /^\/(?!\/)/.test(v) || /^https?:\/\//i.test(v), "url_invalid"),
    image: z.string().trim().max(300, "too_long").optional(),
    tone: z.enum(["dark", "orange", "light"]),
    startsAt: isoDate.optional(),
    endsAt: isoDate.optional(),
    isActive: z.boolean(),
    sortOrder: z.number().int("integer_required").min(0).max(10_000),
  })
  .refine((v) => !v.startsAt || !v.endsAt || Date.parse(v.endsAt) > Date.parse(v.startsAt), { message: "date_range_invalid", path: ["endsAt"] });

function parse(input: unknown): z.output<typeof bannerSchema> {
  const parsed = bannerSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("validation_failed", { fieldErrors: zodFieldErrors(parsed.error) });
  return parsed.data;
}

const strip = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

export function bannerIsLive(b: Banner, now: Date): boolean {
  if (!b.isActive) return false;
  const t = now.getTime();
  if (b.startsAt && Date.parse(b.startsAt) > t) return false;
  if (b.endsAt && Date.parse(b.endsAt) < t) return false;
  return true;
}

export async function getActiveBanners(placement: BannerPlacement, now: Date = new Date()): Promise<Banner[]> {
  const rows = await db.banners.find({ where: (b) => b.placement === placement && bannerIsLive(b, now), orderBy: [{ field: "sortOrder", direction: "asc" }] });
  return rows;
}

export async function listBanners(): Promise<Banner[]> {
  return db.banners.find({ orderBy: [{ field: "placement", direction: "asc" }, { field: "sortOrder", direction: "asc" }] });
}

export async function getBanner(id: Id): Promise<Banner | null> {
  return db.banners.get(id);
}

export async function createBanner(input: BannerInput, actor: Actor): Promise<Banner> {
  const data = parse(input);
  const at = nowIso();
  return db.transaction(async () => {
    const banner = await db.banners.insert({ ...strip(data), createdAt: at, updatedAt: at });
    await logAudit({ actor, action: "banner.create", entityType: "banner", entityId: banner.id, summary: `Created banner "${banner.title.en}"` });
    return banner;
  });
}

export async function updateBanner(id: Id, input: Partial<BannerInput>, actor: Actor): Promise<Banner> {
  return db.transaction(async () => {
    const current = await db.banners.get(id);
    if (!current) throw notFound("banner");
    const { id: _id, createdAt: _c, updatedAt: _u, ...editable } = current;
    void _id;
    void _c;
    void _u;
    const merged = parse({ ...editable, ...input });
    const clear: Partial<Banner> = {};
    for (const key of ["image", "startsAt", "endsAt"] as const) if (merged[key] === undefined) clear[key] = undefined;
    const saved = await db.banners.update(id, { ...clear, ...strip(merged), updatedAt: nowIso() });
    await logAudit({ actor, action: "banner.update", entityType: "banner", entityId: id, summary: `Updated banner "${saved.title.en}"`, changes: diffFields(current, saved, ["placement", "title", "ctaHref", "isActive", "sortOrder", "startsAt", "endsAt"]) });
    return saved;
  });
}

export async function deleteBanner(id: Id, actor: Actor): Promise<void> {
  await db.transaction(async () => {
    const current = await db.banners.get(id);
    if (!current) throw notFound("banner");
    await db.banners.delete(id);
    await logAudit({ actor, action: "banner.delete", entityType: "banner", entityId: id, summary: `Deleted banner "${current.title.en}"` });
  });
}

import "server-only";
import { z } from "zod";
import { zodFieldErrors } from "@/lib/action-result";
import { db } from "@/lib/db";
import { DomainError, notFound } from "@/lib/errors";
import type { Actor, CmsPage, Id, ISODate } from "@/lib/types/domain";
import { slugSchema } from "@/lib/validation/common";
import type { CmsPageInput } from "./contracts";
import { logAudit } from "./audit";
import { diffFields, nowIso } from "./_shared";

const loc = (max: number, required: boolean) => {
  const base = z.string().trim().max(max, "too_long");
  return z.object({ en: required ? base.min(1, "required") : base, tr: base });
};

const pageSchema = z.object({
  slug: slugSchema,
  title: loc(150, true),
  body: loc(60_000, true),
  isPublished: z.boolean(),
  showInFooter: z.boolean(),
  sortOrder: z.number().int("integer_required").min(0).max(10_000),
  seoDescription: loc(300, false).optional(),
});

function parse(input: unknown, partial = false): z.output<typeof pageSchema> {
  const parsed = (partial ? pageSchema.partial() : pageSchema).safeParse(input);
  if (!parsed.success) throw new DomainError("validation_failed", { fieldErrors: zodFieldErrors(parsed.error) });
  return parsed.data as z.output<typeof pageSchema>;
}

export async function getPageBySlug(slug: string, opts: { includeUnpublished?: boolean } = {}): Promise<CmsPage | null> {
  return db.pages.findOne((p) => p.slug === slug && (opts.includeUnpublished || p.isPublished));
}

export async function listFooterPages(): Promise<Pick<CmsPage, "slug" | "title" | "sortOrder">[]> {
  const rows = await db.pages.find({ where: (p) => p.isPublished && p.showInFooter, orderBy: [{ field: "sortOrder", direction: "asc" }] });
  return rows.map((p) => ({ slug: p.slug, title: p.title, sortOrder: p.sortOrder }));
}

export async function listPublishedSlugs(): Promise<{ slug: string; updatedAt: ISODate }[]> {
  const rows = await db.pages.find({ where: (p) => p.isPublished });
  return rows.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt }));
}

export async function listPages(): Promise<CmsPage[]> {
  return db.pages.find({ orderBy: [{ field: "sortOrder", direction: "asc" }] });
}

export async function getPageById(id: Id): Promise<CmsPage | null> {
  return db.pages.get(id);
}

export async function createPage(input: CmsPageInput, actor: Actor): Promise<CmsPage> {
  const data = parse(input);
  return db.transaction(async () => {
    if (await db.pages.findOne((p) => p.slug === data.slug)) throw new DomainError("slug_taken", { status: 409 });
    const at = nowIso();
    const page = await db.pages.insert({ ...data, ...(data.seoDescription ? {} : { seoDescription: undefined }), createdAt: at, updatedAt: at } as Omit<CmsPage, "id">);
    await logAudit({ actor, action: "page.create", entityType: "page", entityId: page.id, summary: `Created page /${page.slug}` });
    return page;
  });
}

export async function updatePage(id: Id, input: Partial<CmsPageInput>, actor: Actor): Promise<CmsPage> {
  const patch = parse(input, true) as Partial<CmsPageInput>;
  return db.transaction(async () => {
    const current = await db.pages.get(id);
    if (!current) throw notFound("page");
    if (patch.slug && patch.slug !== current.slug && (await db.pages.findOne((p) => p.slug === patch.slug && p.id !== id))) throw new DomainError("slug_taken", { status: 409 });
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const saved = await db.pages.update(id, { ...clean, ...("seoDescription" in input && input.seoDescription === undefined ? { seoDescription: undefined } : {}), updatedAt: nowIso() });
    await logAudit({ actor, action: "page.update", entityType: "page", entityId: id, summary: `Updated page /${saved.slug}`, changes: diffFields(current, saved, ["slug", "title", "body", "isPublished", "showInFooter", "sortOrder"]) });
    return saved;
  });
}

export async function deletePage(id: Id, actor: Actor): Promise<void> {
  await db.transaction(async () => {
    const current = await db.pages.get(id);
    if (!current) throw notFound("page");
    await db.pages.delete(id);
    await logAudit({ actor, action: "page.delete", entityType: "page", entityId: id, summary: `Deleted page /${current.slug}` });
  });
}

"use server";

import { createBanner, deleteBanner, updateBanner } from "@/lib/services/banners";
import { createPage, deletePage, updatePage } from "@/lib/services/cms";
import { deleteMessage, updateMessage } from "@/lib/services/contact";
import { deleteSubscriber } from "@/lib/services/newsletter";
import type { BannerInput, CmsPageInput } from "@/lib/services/contracts";
import { adminAction, prefixFieldErrors, refresh } from "./_shared";
import { deleteByIdSchema, messageUpdateSchema, saveBannerSchema, savePageSchema, subscriberDeleteSchema } from "./content.schema";

export async function saveBannerAction(raw: unknown) {
  return adminAction("marketing.write", saveBannerSchema, raw, async ({ id, banner }, { actor }) => {
    const input: BannerInput = {
      placement: banner.placement,
      title: banner.title,
      subtitle: banner.subtitle,
      ctaLabel: banner.ctaLabel,
      ctaHref: banner.ctaHref,
      ...(banner.image ? { image: banner.image } : {}),
      tone: banner.tone,
      ...(banner.startsAt ? { startsAt: `${banner.startsAt}T00:00:00.000Z` } : {}),
      ...(banner.endsAt ? { endsAt: `${banner.endsAt}T23:59:59.000Z` } : {}),
      isActive: banner.isActive,
      sortOrder: banner.sortOrder,
    };
    const saved = id
      ? await updateBanner(id, input, actor).catch((e) => prefixFieldErrors(e, "banner"))
      : await createBanner(input, actor).catch((e) => prefixFieldErrors(e, "banner"));
    refresh(["/admin/banners"], { store: true });
    return { id: saved.id };
  });
}

export async function deleteBannerAction(raw: unknown) {
  return adminAction("marketing.write", deleteByIdSchema, raw, async ({ id }, { actor }) => {
    await deleteBanner(id, actor);
    refresh(["/admin/banners"], { store: true });
  });
}

export async function savePageAction(raw: unknown) {
  return adminAction("cms.write", savePageSchema, raw, async ({ id, page }, { actor }) => {
    const seo = page.seoDescription.en || page.seoDescription.tr ? page.seoDescription : undefined;
    const input: CmsPageInput = {
      slug: page.slug,
      title: page.title,
      body: page.body,
      isPublished: page.isPublished,
      showInFooter: page.showInFooter,
      sortOrder: page.sortOrder,
      ...(seo ? { seoDescription: seo } : {}),
    };
    const saved = id
      ? await updatePage(id, input, actor).catch((e) => prefixFieldErrors(e, "page"))
      : await createPage(input, actor).catch((e) => prefixFieldErrors(e, "page"));
    refresh(["/admin/pages", `/admin/pages/${saved.id}`], { store: true });
    return { id: saved.id };
  });
}

export async function deletePageAction(raw: unknown) {
  return adminAction("cms.write", deleteByIdSchema, raw, async ({ id }, { actor }) => {
    await deletePage(id, actor);
    refresh(["/admin/pages"], { store: true });
  });
}

export async function updateMessageAction(raw: unknown) {
  return adminAction("orders.write", messageUpdateSchema, raw, async ({ id, status, adminNotes }, { actor }) => {
    await updateMessage(id, { ...(status ? { status } : {}), ...(adminNotes !== undefined ? { adminNotes } : {}) }, actor);
    refresh(["/admin/messages", "/admin"]);
  });
}

export async function deleteMessageAction(raw: unknown) {
  return adminAction("orders.write", deleteByIdSchema, raw, async ({ id }, { actor }) => {
    await deleteMessage(id, actor);
    refresh(["/admin/messages", "/admin"]);
  });
}

export async function deleteSubscriberAction(raw: unknown) {
  return adminAction("marketing.write", subscriberDeleteSchema, raw, async ({ id }, { actor }) => {
    await deleteSubscriber(id, actor);
    refresh(["/admin/newsletter"]);
  });
}

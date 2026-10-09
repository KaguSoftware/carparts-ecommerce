import type { MetadataRoute } from "next";
import { LOCALES } from "@/i18n/routing";
import { siteUrl } from "@/lib/env";
import { listSitemapEntries } from "@/lib/services/catalog";
import { listPublishedSlugs } from "@/lib/services/cms";

export const dynamic = "force-dynamic";

/** Every public storefront URL in every locale, with hreflang alternates so crawlers pair the translations. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [entries, pages] = await Promise.all([listSitemapEntries(), listPublishedSlugs()]);

  const make = (path: string, lastModified: Date | string | undefined, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"], priority: number): MetadataRoute.Sitemap =>
    LOCALES.map((locale) => ({
      url: `${base}/${locale}${path}`,
      ...(lastModified ? { lastModified } : {}),
      changeFrequency,
      priority,
      alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `${base}/${l}${path}`])) },
    }));

  return [
    ...make("", undefined, "daily", 1),
    ...make("/shop", undefined, "daily", 0.9),
    ...make("/deals", undefined, "daily", 0.8),
    ...make("/brands", undefined, "weekly", 0.6),
    ...make("/contact", undefined, "yearly", 0.4),
    ...make("/track-order", undefined, "yearly", 0.2),
    ...entries.categories.flatMap((c) => make(`/category/${c.slug}`, c.updatedAt, "weekly", 0.8)),
    ...entries.brands.flatMap((b) => make(`/brand/${b.slug}`, b.updatedAt, "weekly", 0.6)),
    ...entries.products.flatMap((p) => make(`/product/${p.slug}`, p.updatedAt, "weekly", 0.7)),
    ...pages.flatMap((p) => make(`/pages/${p.slug}`, p.updatedAt, "monthly", 0.3)),
  ];
}

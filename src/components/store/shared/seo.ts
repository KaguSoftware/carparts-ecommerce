import type { Metadata } from "next";
import { LOCALES, type Locale } from "@/i18n/routing";

/**
 * Per-page alternates (canonical + hreflang) for storefront pages. `path` is the UNPREFIXED path
 * ("" for home, "/shop", "/product/abc"). Relative URLs resolve against `metadataBase` set in the root layout.
 */
export function localizedAlternates(locale: Locale, path: string): NonNullable<Metadata["alternates"]> {
  const clean = path === "/" ? "" : path;
  return {
    canonical: `/${locale}${clean}`,
    languages: {
      ...Object.fromEntries(LOCALES.map((l) => [l, `/${l}${clean}`])),
      "x-default": `/en${clean}`,
    },
  };
}

export interface PageMetaInput {
  locale: Locale;
  path: string;
  /** Plain string (gets the site template) or { absolute } to bypass it. */
  title: string | { absolute: string };
  description?: string;
  image?: string;
  /** Keep thin / parameterised pages out of the index while still following links. */
  noindex?: boolean;
  type?: "website" | "article";
}

export function pageMetadata({ locale, path, title, description, image, noindex, type = "website" }: PageMetaInput): Metadata {
  const ogTitle = typeof title === "string" ? title : title.absolute;
  return {
    title,
    ...(description ? { description } : {}),
    alternates: localizedAlternates(locale, path),
    openGraph: {
      type,
      title: ogTitle,
      ...(description ? { description } : {}),
      url: `/${locale}${path === "/" ? "" : path}`,
      locale: locale === "tr" ? "tr_TR" : "en_US",
      ...(image ? { images: [{ url: image }] } : {}),
    },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Clamp a meta description to a search-friendly length without cutting mid-word. */
export function clampDescription(text: string, max = 158): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 80 ? cut.lastIndexOf(" ") : cut.length)}…`;
}

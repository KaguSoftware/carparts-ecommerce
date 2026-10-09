import type { Metadata } from "next";

/** Account, auth and checkout pages are private and never belong in a search index. */
export function privatePageMetadata(title: string): Metadata {
  return { title, robots: { index: false, follow: false } };
}

/** First value of a possibly repeated search param. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

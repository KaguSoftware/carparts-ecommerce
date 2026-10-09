import "server-only";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/routing";
import { getStoreContext } from "../shared/context";
import { parseListingParams, type SearchParamsInput } from "./listing-params";
import { loadListing, type LoadListingInput } from "./load-listing";

/** Validates the locale segment, parses the URL filters and loads the listing in one step. */
export async function loadListingPage(input: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
  fixed?: LoadListingInput["fixed"];
}) {
  const { locale: raw } = await input.params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  setRequestLocale(locale);
  const [sp, ctx] = await Promise.all([input.searchParams, getStoreContext(locale)]);
  const params = parseListingParams(sp);
  const result = await loadListing({ locale, params, vehicle: ctx.vehicle, hasVehicle: ctx.hasVehicle, ...(input.fixed ? { fixed: input.fixed } : {}) });
  return { locale, ctx, params, result };
}

import "server-only";
import type { Locale } from "@/i18n/routing";
import type { ProductListResult, ProductQuery } from "@/lib/services/contracts";
import { getProductSummaries, listProducts } from "@/lib/services/catalog";
import { searchProducts } from "@/lib/services/search";
import type { VehicleSelection } from "@/lib/types/domain";
import { PAGE_SIZE, type ListingParams } from "./listing-params";

export interface LoadListingInput {
  locale: Locale;
  params: ListingParams;
  vehicle: VehicleSelection;
  hasVehicle: boolean;
  /** Constraints owned by the page (category, brand, deals...). */
  fixed?: Pick<ProductQuery, "categorySlug" | "brandSlugs" | "onSale" | "featured">;
}

export type ListingResult = ProductListResult & { didYouMean?: string; filteredByVehicle: boolean };

/**
 * One call for every listing page: applies URL filters + the saved vehicle (unless the visitor chose "show all parts")
 * and always returns `fitsSelectedVehicle` on each card when a vehicle is saved.
 */
export async function loadListing({ locale, params, vehicle, hasVehicle, fixed = {} }: LoadListingInput): Promise<ListingResult> {
  const filteredByVehicle = hasVehicle && !params.showAll;
  const brandSlugs = fixed.brandSlugs?.length ? fixed.brandSlugs : params.brands;
  const base: ProductQuery = {
    ...fixed,
    ...(brandSlugs.length ? { brandSlugs } : {}),
    ...(params.minPrice !== undefined ? { minPrice: params.minPrice } : {}),
    ...(params.maxPrice !== undefined ? { maxPrice: params.maxPrice } : {}),
    ...(params.inStock ? { inStockOnly: true } : {}),
    ...(params.onSale || fixed.onSale ? { onSale: true } : {}),
    ...(params.minRating !== undefined ? { minRating: params.minRating } : {}),
    ...(filteredByVehicle ? { vehicle } : {}),
    sort: params.sort,
    page: params.page,
    pageSize: PAGE_SIZE,
    locale,
  };
  const result: ListingResult = params.q
    ? { ...(await searchProducts({ ...base, q: params.q })), filteredByVehicle }
    : { ...(await listProducts(base)), filteredByVehicle };

  // "Show all parts" with a saved vehicle: overlay fit flags so cards can still say fits / does not fit.
  if (hasVehicle && !filteredByVehicle && result.items.length) {
    const flagged = await getProductSummaries(
      result.items.map((p) => p.id),
      { vehicle },
    );
    const byId = new Map(flagged.map((p) => [p.id, p.fitsSelectedVehicle]));
    result.items = result.items.map((p) => {
      const fits = byId.get(p.id);
      return fits === undefined ? p : { ...p, fitsSelectedVehicle: fits };
    });
  }
  return result;
}

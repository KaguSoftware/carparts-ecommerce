import { getTranslations } from "next-intl/server";
import { CarFront, PackageSearch, X } from "lucide-react";
import { Alert, buttonStyles, Pagination } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { localize } from "@/lib/i18n-string";
import { formatMoney } from "@/lib/money";
import { ProductCard, ProductGrid } from "../product/ProductCard";
import type { StoreContext } from "../shared/context";
import { FiltersDrawer, FiltersSidebar, SortSelect, type FilterFacets } from "./ListingFilters";
import { activeFilterCount, listingHref, type ListingParams } from "./listing-params";
import type { ListingResult } from "./load-listing";

export interface ProductListingProps {
  locale: Locale;
  ctx: StoreContext;
  result: ListingResult;
  params: ListingParams;
  /** Unprefixed path of the page ("/shop", "/category/brakes", "/search"). */
  basePath: string;
  showBrands?: boolean;
  showCategories?: boolean;
  /** Limit the category facet to these slugs (e.g. top-level categories only). */
  categorySlugs?: ReadonlySet<string>;
  /** Where the category facet links lead; default is the category page itself. */
  categoryHref?: (slug: string) => string;
  /** Rendered when there are no parts at all (no filters applied). */
  emptyHint?: React.ReactNode;
}

/**
 * The shared catalogue view: result count, garage banner, sort + filters, active filter chips, grid and pagination.
 * Facets, sort and page live in the URL so every state is linkable and crawlable.
 */
export async function ProductListing({ locale, ctx, result, params, basePath, showBrands = true, showCategories = true, categorySlugs, categoryHref, emptyHint }: ProductListingProps) {
  const t = await getTranslations("store.listing");
  const filterCount = activeFilterCount(params);

  const facets: FilterFacets = {
    brands: result.facets.brands.map((b) => ({ slug: b.slug, name: b.name, count: b.count })),
    categories: result.facets.categories.filter((c) => !categorySlugs || categorySlugs.has(c.slug)).map((c) => ({
      slug: c.slug,
      name: localize(c.name, locale),
      count: c.count,
      href: categoryHref ? categoryHref(c.slug) : listingHref(`/category/${c.slug}`, { ...params, page: 1 }),
    })),
    priceRange: result.facets.priceRange,
    inStockCount: result.facets.inStockCount,
    onSaleCount: result.facets.onSaleCount,
    ratings: result.facets.ratings,
  };

  const chips: { key: string; label: string; href: string }[] = [];
  for (const slug of params.brands) {
    const name = result.facets.brands.find((b) => b.slug === slug)?.name ?? slug;
    chips.push({ key: `b-${slug}`, label: name, href: listingHref(basePath, { ...params, brands: params.brands.filter((b) => b !== slug), page: 1 }) });
  }
  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    const label =
      params.minPrice !== undefined && params.maxPrice !== undefined
        ? t("chipPriceRange", { min: formatMoney(params.minPrice, locale, ctx.currency), max: formatMoney(params.maxPrice, locale, ctx.currency) })
        : params.minPrice !== undefined
          ? t("chipPriceFrom", { amount: formatMoney(params.minPrice, locale, ctx.currency) })
          : t("chipPriceTo", { amount: formatMoney(params.maxPrice as number, locale, ctx.currency) });
    chips.push({ key: "price", label, href: listingHref(basePath, { ...params, minPrice: undefined, maxPrice: undefined, page: 1 }) });
  }
  if (params.inStock) chips.push({ key: "stock", label: t("inStock"), href: listingHref(basePath, { ...params, inStock: false, page: 1 }) });
  if (params.onSale) chips.push({ key: "sale", label: t("onSale"), href: listingHref(basePath, { ...params, onSale: false, page: 1 }) });
  if (params.minRating !== undefined) chips.push({ key: "rating", label: t("ratingAndUp", { rating: params.minRating }), href: listingHref(basePath, { ...params, minRating: undefined, page: 1 }) });

  const clearAll = listingHref(basePath, { q: params.q, sort: params.sort, showAll: params.showAll });
  const from = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const to = Math.min(result.total, result.page * result.pageSize);

  return (
    <div>
      {ctx.hasVehicle && ctx.vehicleLabel ? (
        <div className="mb-6">
          {result.filteredByVehicle ? (
            <Alert tone="success" title={t("garageFiltered", { label: ctx.vehicleLabel })}>
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>{t("garageFilteredHint")}</span>
                <Link href={listingHref(basePath, { ...params, showAll: true, page: 1 })} className="font-semibold underline underline-offset-4 hover:no-underline">
                  {t("showAllParts")}
                </Link>
              </span>
            </Alert>
          ) : (
            <Alert tone="info" title={t("garageAll", { label: ctx.vehicleLabel })}>
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>{t("garageAllHint")}</span>
                <Link href={listingHref(basePath, { ...params, showAll: false, page: 1 })} className="font-semibold underline underline-offset-4 hover:no-underline">
                  {t("onlyFitting")}
                </Link>
              </span>
            </Alert>
          )}
        </div>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-10 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
        <FiltersSidebar basePath={basePath} params={params} facets={facets} currency={ctx.currency} showBrands={showBrands} showCategories={showCategories} />

        <section aria-labelledby="listing-heading">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-border pb-4">
            <div>
              <h2 id="listing-heading" className="sr-only">
                {t("resultsHeading")}
              </h2>
              <p className="text-[0.9375rem] text-muted" aria-live="polite">
                {result.total === 0 ? t("noParts") : t("showing", { from, to, total: result.total })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <FiltersDrawer activeCount={filterCount} basePath={basePath} params={params} facets={facets} currency={ctx.currency} showBrands={showBrands} showCategories={showCategories} />
              <SortSelect basePath={basePath} params={params} />
            </div>
          </div>

          {chips.length > 0 ? (
            <ul className="mt-4 flex flex-wrap items-center gap-2" aria-label={t("activeFilters")}>
              {chips.map((chip) => (
                <li key={chip.key}>
                  <Link
                    href={chip.href}
                    scroll={false}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-sm border border-border-strong bg-surface px-3 text-[0.8125rem] font-medium hover:border-foreground"
                  >
                    {chip.label}
                    <X className="size-3.5" aria-hidden />
                    <span className="sr-only">{t("removeFilter")}</span>
                  </Link>
                </li>
              ))}
              <li>
                <Link href={clearAll} scroll={false} className={buttonStyles({ variant: "link" })}>
                  {t("clearFilters")}
                </Link>
              </li>
            </ul>
          ) : null}

          {result.didYouMean ? (
            <p className="mt-4 text-[0.9375rem]">
              {t("didYouMean")}{" "}
              <Link href={listingHref(basePath, { ...params, q: result.didYouMean, page: 1 })} className="font-semibold text-primary-text underline underline-offset-4 hover:no-underline">
                {result.didYouMean}
              </Link>
            </p>
          ) : null}

          {result.items.length > 0 ? (
            <>
              <ProductGrid className="mt-6 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
                {result.items.map((product, i) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    locale={locale}
                    currency={ctx.currency}
                    signedIn={Boolean(ctx.user)}
                    inWishlist={ctx.wishlistIds.has(product.id)}
                    priority={i < 4}
                  />
                ))}
              </ProductGrid>
              <Pagination
                className="mt-12"
                page={result.page}
                pageCount={result.pageCount}
                linkAs={Link}
                buildHref={(page) => listingHref(basePath, { ...params, page })}
              />
            </>
          ) : (
            <div className="mt-6 flex flex-col items-center gap-4 rounded-md border border-dashed border-border-strong px-6 py-16 text-center">
              {ctx.hasVehicle && result.filteredByVehicle && filterCount === 0 && !params.q ? <CarFront className="size-10 text-subtle" strokeWidth={1.5} aria-hidden /> : <PackageSearch className="size-10 text-subtle" strokeWidth={1.5} aria-hidden />}
              <div className="max-w-md space-y-1.5">
                <p className="display-4">{t("emptyTitle")}</p>
                <p className="text-muted">{filterCount > 0 || params.q ? t("emptyFiltered") : (emptyHint ?? t("emptyBody"))}</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {filterCount > 0 ? (
                  <Link href={clearAll} className={buttonStyles({ variant: "primary" })}>
                    {t("clearFilters")}
                  </Link>
                ) : null}
                {result.filteredByVehicle ? (
                  <Link href={listingHref(basePath, { ...params, showAll: true, page: 1 })} className={buttonStyles({ variant: "outline" })}>
                    {t("showAllParts")}
                  </Link>
                ) : null}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Search } from "lucide-react";
import { Breadcrumbs } from "@/components/ui";
import { ProductListing } from "@/components/store/catalog/ProductListing";
import { loadListingPage } from "@/components/store/catalog/load-page";
import { activeFilterCount, parseListingParams, type SearchParamsInput } from "@/components/store/catalog/listing-params";
import { pageMetadata } from "@/components/store/shared/seo";
import { Link } from "@/i18n/navigation";
import { isLocale } from "@/i18n/routing";
import { localize } from "@/lib/i18n-string";
import { getCategoryTree } from "@/lib/services/catalog";
import { getPopularSearches, recordSearch } from "@/lib/services/search";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParamsInput> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "store.search" });
  const { q } = parseListingParams(await searchParams);
  return pageMetadata({ locale, path: "/search", title: q ? t("pageTitleQuery", { query: q }) : t("pageTitle"), noindex: true });
}

export default async function SearchPage(props: Props) {
  const { locale: rawLocale } = await props.params;
  if (!isLocale(rawLocale)) notFound();
  setRequestLocale(rawLocale);
  const t = await getTranslations("store.search");

  const q = parseListingParams(await props.searchParams).q;

  if (!q) {
    const [popular, tree] = await Promise.all([getPopularSearches(rawLocale), getCategoryTree()]);
    return (
      <div className="container-page py-8 md:py-12">
        <Breadcrumbs linkAs={Link} items={[{ label: t("home"), href: "/" }, { label: t("pageTitle") }]} />
        <div className="mt-8 max-w-2xl">
          <h1 className="display-2">{t("pageTitle")}</h1>
          <p className="mt-3 text-[1.0625rem] text-muted">{t("emptyIntro")}</p>
        </div>
        {popular.length > 0 ? (
          <section className="mt-10" aria-labelledby="popular-searches">
            <h2 id="popular-searches" className="display-4">
              {t("popular")}
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2.5">
              {popular.map((term) => (
                <li key={term}>
                  <Link
                    href={`/search?q=${encodeURIComponent(term)}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-border-strong bg-surface px-4 text-[0.9375rem] font-medium hover:border-foreground"
                  >
                    <Search className="size-4 text-muted" aria-hidden />
                    {term}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section className="mt-10" aria-labelledby="browse-categories">
          <h2 id="browse-categories" className="display-4">
            {t("browse")}
          </h2>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
            {tree
              .filter((c) => c.isActive && c.productCount > 0)
              .map((c) => (
                <li key={c.slug}>
                  <Link href={`/category/${c.slug}`} className="flex min-h-12 items-center justify-between gap-3 rounded-sm border border-border bg-surface px-4 font-medium hover:border-border-strong hover:text-primary-text">
                    {localize(c.name, rawLocale)}
                    <span className="num text-[0.8125rem] text-subtle">{c.productCount}</span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      </div>
    );
  }

  const { locale, ctx, params, result } = await loadListingPage(props);
  const topSlugs = new Set((await getCategoryTree()).filter((c) => c.isActive).map((c) => c.slug));
  if (result.page === 1 && activeFilterCount(params) === 0) {
    void recordSearch(q, result.total).catch(() => undefined);
  }

  return (
    <div className="container-page py-8 md:py-12">
      <Breadcrumbs linkAs={Link} items={[{ label: t("home"), href: "/" }, { label: t("pageTitle") }]} />
      <div className="mb-8 mt-6">
        <h1 className="display-2 normal-case!">{t("heading", { query: q })}</h1>
      </div>
      <ProductListing locale={locale} ctx={ctx} result={result} params={params} basePath="/search" categorySlugs={topSlugs} />
    </div>
  );
}


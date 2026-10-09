import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Breadcrumbs } from "@/components/ui";
import { CatalogHero } from "@/components/store/catalog/CatalogHero";
import { ProductListing } from "@/components/store/catalog/ProductListing";
import { loadListingPage } from "@/components/store/catalog/load-page";
import type { SearchParamsInput } from "@/components/store/catalog/listing-params";
import { pageMetadata } from "@/components/store/shared/seo";
import { Link } from "@/i18n/navigation";
import { isLocale } from "@/i18n/routing";
import { getCategoryTree } from "@/lib/services/catalog";
import { localize } from "@/lib/i18n-string";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParamsInput> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "store.shop" });
  const sp = await searchParams;
  const filtered = Object.keys(sp).some((k) => k !== "page");
  return pageMetadata({ locale, path: "/shop", title: t("metaTitle"), description: t("metaDescription"), noindex: filtered });
}

export default async function ShopPage(props: Props) {
  const { locale, ctx, params, result } = await loadListingPage(props);
  const t = await getTranslations("store.shop");
  const tCommon = await getTranslations("store.listing");
  const tree = await getCategoryTree();
  const top = tree.filter((c) => c.isActive && c.productCount > 0).map((c) => ({ slug: c.slug, name: localize(c.name, locale), count: c.productCount }));

  return (
    <>
      <div className="container-page pb-4 pt-5">
        <Breadcrumbs linkAs={Link} items={[{ label: t("home"), href: "/" }, { label: t("title") }]} />
      </div>
      <CatalogHero
        title={t("title")}
        description={t("description")}
        section={0}
        meta={tCommon("headerMeta", { parts: top.reduce((n, c) => n + c.count, 0), subs: top.length })}
        image="/products/cat-brakes.svg"
        className="[&_.container-page]:md:py-6"
      />
      <div className="container-page py-8 md:py-10">
        <ProductListing locale={locale} ctx={ctx} result={result} params={params} basePath="/shop" categorySlugs={new Set(top.map((c) => c.slug))} />
      </div>
    </>
  );
}

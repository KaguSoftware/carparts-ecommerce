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

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParamsInput> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "store.deals" });
  const sp = await searchParams;
  return pageMetadata({ locale, path: "/deals", title: t("metaTitle"), description: t("metaDescription"), noindex: Object.keys(sp).some((k) => k !== "page") });
}

export default async function DealsPage(props: Props) {
  const { locale, ctx, params, result } = await loadListingPage({ ...props, fixed: { onSale: true } });
  const t = await getTranslations("store.deals");
  return (
    <>
      <div className="container-page pb-4 pt-5">
        <Breadcrumbs linkAs={Link} items={[{ label: t("home"), href: "/" }, { label: t("title") }]} />
      </div>
      <CatalogHero title={t("title")} description={t("description")} image="/products/banner-deals.svg" />
      <div className="container-page py-8 md:py-10">
        <ProductListing locale={locale} ctx={ctx} result={result} params={params} basePath="/deals" />
      </div>
    </>
  );
}

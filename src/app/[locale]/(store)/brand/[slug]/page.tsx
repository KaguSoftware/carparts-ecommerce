import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Breadcrumbs } from "@/components/ui";
import { CatalogHero } from "@/components/store/catalog/CatalogHero";
import { ProductListing } from "@/components/store/catalog/ProductListing";
import { loadListingPage } from "@/components/store/catalog/load-page";
import type { SearchParamsInput } from "@/components/store/catalog/listing-params";
import { clampDescription, pageMetadata } from "@/components/store/shared/seo";
import { Link } from "@/i18n/navigation";
import { isLocale } from "@/i18n/routing";
import { localize } from "@/lib/i18n-string";
import { getBrandBySlug } from "@/lib/services/catalog";

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<SearchParamsInput> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const brand = await getBrandBySlug(slug);
  if (!brand || !brand.isActive) return {};
  const t = await getTranslations({ locale, namespace: "store.brand" });
  const sp = await searchParams;
  return pageMetadata({
    locale,
    path: `/brand/${slug}`,
    title: t("metaTitle", { name: brand.name }),
    description: clampDescription(localize(brand.description, locale)),
    ...(brand.logo ? { image: brand.logo } : {}),
    noindex: Object.keys(sp).some((k) => k !== "page"),
  });
}

export default async function BrandPage(props: Props) {
  const { slug } = await props.params;
  const brand = await getBrandBySlug(slug);
  if (!brand || !brand.isActive) notFound();

  const { locale, ctx, params, result } = await loadListingPage({ ...props, fixed: { brandSlugs: [slug] } });
  const t = await getTranslations("store.brand");

  return (
    <>
      <div className="container-page pb-4 pt-5">
        <Breadcrumbs linkAs={Link} items={[{ label: t("home"), href: "/" }, { label: t("brands"), href: "/brands" }, { label: brand.name }]} />
      </div>
      <CatalogHero
        title={brand.name}
        description={localize(brand.description, locale)}
        badge={
          brand.logo ? (
            <Image src={brand.logo} alt={t("logoAlt", { name: brand.name })} width={240} height={100} unoptimized className="h-auto w-44 shrink-0 rounded-md border border-inverse-border sm:w-52" />
          ) : null
        }
      >
        {brand.country ? (
          <p className="mt-5 text-sm text-inverse-muted">
            {t("origin")}: <span className="font-medium text-inverse-foreground">{brand.country}</span>
          </p>
        ) : null}
      </CatalogHero>
      <div className="container-page py-8 md:py-10">
        <ProductListing locale={locale} ctx={ctx} result={result} params={params} basePath={`/brand/${slug}`} showBrands={false} categoryHref={(s) => `/category/${s}?brand=${slug}`} />
      </div>
    </>
  );
}

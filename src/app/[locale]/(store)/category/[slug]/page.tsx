import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowRight, CarFront } from "lucide-react";
import { Breadcrumbs } from "@/components/ui";
import { CatalogHero } from "@/components/store/catalog/CatalogHero";
import { SubcategoryNav } from "@/components/store/catalog/SubcategoryNav";
import { ProductListing } from "@/components/store/catalog/ProductListing";
import { loadListingPage } from "@/components/store/catalog/load-page";
import type { SearchParamsInput } from "@/components/store/catalog/listing-params";
import { clampDescription, pageMetadata } from "@/components/store/shared/seo";
import { Link } from "@/i18n/navigation";
import { isLocale } from "@/i18n/routing";
import { localize } from "@/lib/i18n-string";
import { getActiveBanners } from "@/lib/services/banners";
import { getCategoryBySlug, getCategoryPath, getCategoryTree } from "@/lib/services/catalog";
import type { CategoryNode } from "@/lib/types/domain";

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<SearchParamsInput> };

function findNode(nodes: CategoryNode[], slug: string): CategoryNode | null {
  for (const n of nodes) {
    if (n.slug === slug) return n;
    const child = findNode(n.children, slug);
    if (child) return child;
  }
  return null;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const category = await getCategoryBySlug(slug);
  if (!category || !category.isActive) return {};
  const sp = await searchParams;
  const title = localize(category.seoTitle, locale) || localize(category.name, locale);
  const description = clampDescription(localize(category.seoDescription, locale) || localize(category.description, locale));
  return pageMetadata({ locale, path: `/category/${slug}`, title, description, ...(category.image ? { image: category.image } : {}), noindex: Object.keys(sp).some((k) => k !== "page") });
}

export default async function CategoryPage(props: Props) {
  const { slug } = await props.params;
  const category = await getCategoryBySlug(slug);
  if (!category || !category.isActive) notFound();

  const { locale, ctx, params, result } = await loadListingPage({ ...props, fixed: { categorySlug: slug } });
  const t = await getTranslations("store.category");
  const tl = await getTranslations("store.listing");
  const [path, tree, promo] = await Promise.all([getCategoryPath(category.id), getCategoryTree(), getActiveBanners("category_top")]);
  const node = findNode(tree, slug);
  const subcategories = (node?.children ?? []).filter((c) => c.isActive && c.productCount > 0).map((c) => ({ slug: c.slug, name: localize(c.name, locale), count: c.productCount }));
  const name = localize(category.name, locale);
  const banner = promo[0];
  const rootIndex = Math.max(0, tree.findIndex((c) => c.id === (path[0]?.id ?? category.id)));
  const section = path.length > 1 ? `${String(rootIndex + 1).padStart(2, "0")}.${(tree[rootIndex]?.children.findIndex((c) => c.id === category.id) ?? 0) + 1}` : rootIndex + 1;

  return (
    <>
      <div className="container-page pb-4 pt-5">
        <Breadcrumbs
          linkAs={Link}
          items={[
            { label: t("home"), href: "/" },
            { label: t("shop"), href: "/shop" },
            ...path.map((c, i) => ({ label: localize(c.name, locale), ...(i < path.length - 1 ? { href: `/category/${c.slug}` } : {}) })),
          ]}
        />
      </div>
      <CatalogHero
        title={name}
        description={localize(category.description, locale)}
        section={section}
        meta={tl("headerMeta", { parts: node?.productCount ?? result.total, subs: subcategories.length })}
        image={category.image ?? path.map((c) => c.image).find(Boolean) ?? "/products/cat-brakes.svg"}
      >
        <SubcategoryNav label={t("subcategories")} items={subcategories} />
      </CatalogHero>

      {banner && !ctx.hasVehicle ? (
        <div className="container-page mt-6">
          <Link
            href={banner.ctaHref.startsWith("/") ? banner.ctaHref : "/garage"}
            className="group flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-md border border-border bg-surface px-5 py-4 transition-colors hover:border-border-strong"
          >
            <span className="flex items-center gap-3">
              <CarFront className="size-6 shrink-0 text-primary-text" aria-hidden />
              <span>
                <span className="block font-semibold text-foreground">{localize(banner.title, locale)}</span>
                <span className="block text-sm text-muted">{localize(banner.subtitle, locale)}</span>
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-text group-hover:underline">
              {localize(banner.ctaLabel, locale)}
              <ArrowRight className="size-4" aria-hidden />
            </span>
          </Link>
        </div>
      ) : null}

      <div className="container-page py-8 md:py-10">
        <ProductListing locale={locale} ctx={ctx} result={result} params={params} basePath={`/category/${slug}`} showCategories={false} />
      </div>
    </>
  );
}

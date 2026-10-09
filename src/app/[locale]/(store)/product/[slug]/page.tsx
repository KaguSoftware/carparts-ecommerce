import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs, Skeleton } from "@/components/ui";
import { Markdown } from "@/components/ui/Markdown";
import { SheetHeading } from "@/components/shared/SheetHeading";
import { FitmentList } from "@/components/store/product/FitmentList";
import { SpecSheet, type SpecRow } from "@/components/store/product/SpecSheet";
import { FitmentPanel } from "@/components/store/product/FitmentPanel";
import { ProductCard, ProductGrid } from "@/components/store/product/ProductCard";
import { ProductExperience, type PdpImage, type PdpVariant } from "@/components/store/product/ProductExperience";
import { ProductReviews, REVIEW_SORTS, type ReviewSort } from "@/components/store/product/ProductReviews";
import { RatingStars } from "@/components/store/product/RatingStars";
import { getStoreContext } from "@/components/store/shared/context";
import { clampDescription, pageMetadata } from "@/components/store/shared/seo";
import { Link } from "@/i18n/navigation";
import { isLocale } from "@/i18n/routing";
import { siteUrl } from "@/lib/env";
import { localize } from "@/lib/i18n-string";
import { pickDimensionSpecs } from "@/lib/spec-dims";
import { convertFromBase } from "@/lib/money";
import { getProductBySlug } from "@/lib/services/catalog";
import { getPublicSettings } from "@/lib/services/settings";

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const detail = await getProductBySlug(slug);
  if (!detail) return {};
  const { product, brand } = detail;
  const name = localize(product.name, locale);
  const title = localize(product.seoTitle, locale) || `${name} | ${brand.name}`;
  const description = clampDescription(localize(product.seoDescription, locale) || localize(product.summary, locale));
  const image = product.images[0]?.url;
  return pageMetadata({ locale, path: `/product/${slug}`, title, description, ...(image ? { image } : {}) });
}

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function ProductPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const ctx = await getStoreContext(locale);
  const detail = await getProductBySlug(slug, ctx.hasVehicle ? { vehicle: ctx.vehicle } : {});
  if (!detail) notFound();

  const [t, tCard, settings, sp] = await Promise.all([getTranslations("store.product"), getTranslations("store.card"), getPublicSettings(), searchParams]);
  const { product, brand, categoryPath, variants } = detail;
  const name = localize(product.name, locale);
  const rsortRaw = first(sp.rsort) as ReviewSort;
  const rsort = REVIEW_SORTS.includes(rsortRaw) ? rsortRaw : "newest";
  const rpage = Math.max(1, Math.min(500, Number.parseInt(first(sp.rpage), 10) || 1));

  const images: PdpImage[] = [...product.images]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((i) => ({ id: i.id, url: i.url, alt: localize(i.alt, locale) || name }));
  const pdpVariants: PdpVariant[] = variants
    .filter((v) => v.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((v) => ({
      id: v.id,
      sku: v.sku,
      name: localize(v.name, locale),
      price: v.price,
      ...(v.compareAtPrice !== undefined && v.compareAtPrice > v.price ? { compareAtPrice: v.compareAtPrice } : {}),
      available: v.available,
      status: v.stockStatus,
      ...(v.imageId ? { imageId: v.imageId } : {}),
    }));
  const optionNames = new Set(variants.map((v) => (v.options.length === 1 ? localize(v.options[0]?.name, locale) : "")));
  const groupLabel = optionNames.size === 1 && [...optionNames][0] ? ([...optionNames][0] as string) : t("option");

  const dimIndexes = pickDimensionSpecs(product.specs);
  const specRows: SpecRow[] = [
    ...product.specs.map((s, i) => {
      const dim = dimIndexes.indexOf(i);
      return { key: localize(s.key, locale), value: localize(s.value, locale), ...(dim >= 0 ? { dim: dim + 1 } : {}) };
    }),
    ...(product.specs.some((s) => /warrant|garanti/i.test(`${s.key.en} ${s.key.tr}`)) ? [] : [{ key: t("specWarranty"), value: product.warrantyMonths > 0 ? t("warrantyMonths", { count: product.warrantyMonths }) : t("noWarranty") }]),
  ];

  const base = siteUrl();
  const priceFor = (cents: number) => (convertFromBase(cents, ctx.currency) / 100).toFixed(2);
  const lowPrice = Math.min(...pdpVariants.map((v) => v.price));
  const highPrice = Math.max(...pdpVariants.map((v) => v.price));
  const anyInStock = pdpVariants.some((v) => v.status !== "out_of_stock");
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name,
      description: localize(product.summary, locale),
      sku: pdpVariants[0]?.sku,
      mpn: product.partNumber,
      image: images.map((i) => `${base}${i.url}`),
      url: `${base}/${locale}/product/${slug}`,
      brand: { "@type": "Brand", name: brand.name },
      category: localize(detail.category.name, locale),
      ...(product.ratingCount > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.ratingAverage, reviewCount: product.ratingCount } } : {}),
      offers:
        pdpVariants.length > 1
          ? {
              "@type": "AggregateOffer",
              priceCurrency: ctx.currency.currency,
              lowPrice: priceFor(lowPrice),
              highPrice: priceFor(highPrice),
              offerCount: pdpVariants.length,
              availability: anyInStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              url: `${base}/${locale}/product/${slug}`,
            }
          : {
              "@type": "Offer",
              priceCurrency: ctx.currency.currency,
              price: priceFor(lowPrice),
              availability: anyInStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              itemCondition: "https://schema.org/NewCondition",
              url: `${base}/${locale}/product/${slug}`,
            },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: t("home"), item: `${base}/${locale}` },
        ...categoryPath.map((c, i) => ({ "@type": "ListItem", position: i + 2, name: localize(c.name, locale), item: `${base}/${locale}/category/${c.slug}` })),
        { "@type": "ListItem", position: categoryPath.length + 2, name, item: `${base}/${locale}/product/${slug}` },
      ],
    },
  ];

  const heading = (
    <div className="space-y-3">
      <h1 className="display-2 text-[clamp(1.75rem,1.2rem+2.2vw,2.75rem)]">{name}</h1>
      <a href="#reviews" className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground">
        {product.ratingCount > 0 ? (
          <>
            <RatingStars value={product.ratingAverage} size="md" label={tCard("rating", { rating: product.ratingAverage.toFixed(1), count: product.ratingCount })} />
            <span className="underline underline-offset-4">{t("reviewCount", { count: product.ratingCount })}</span>
          </>
        ) : (
          <span className="underline underline-offset-4">{t("beFirst")}</span>
        )}
      </a>
    </div>
  );
  const intro = <p className="max-w-prose text-[1.0625rem] text-foreground/85">{localize(product.summary, locale)}</p>;

  return (
    <>
      {jsonLd.map((data, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />
      ))}
      <div className="container-page pb-6 pt-5">
        <Breadcrumbs
          linkAs={Link}
          items={[
            { label: t("home"), href: "/" },
            ...categoryPath.map((c) => ({ label: localize(c.name, locale), href: `/category/${c.slug}` })),
            { label: brand.name, href: `/brand/${brand.slug}` },
            { label: name },
          ]}
        />
      </div>

      <div className="container-page">
        <ProductExperience
          productId={product.id}
          productName={name}
          images={images}
          variants={pdpVariants}
          defaultVariantId={detail.defaultVariantId}
          variantGroupLabel={groupLabel}
          locale={locale}
          currency={ctx.currency}
          signedIn={Boolean(ctx.user)}
          inWishlist={ctx.wishlistIds.has(product.id)}
          maxQuantity={settings.maxQuantityPerLine}
          warrantyMonths={product.warrantyMonths}
          freeShippingThreshold={settings.freeShippingThreshold}
          heading={heading}
          intro={intro}
          plate={{ partNumber: product.partNumber, oemNumbers: product.oemNumbers, brand: { name: brand.name, href: `/brand/${brand.slug}` } }}
          fitment={<FitmentPanel productId={product.id} ctx={ctx} />}
        />
      </div>

      <div className="container-page mt-16 space-y-16 md:mt-20 md:space-y-20">
        <section aria-labelledby="specs-heading">
          <SheetHeading id="specs-heading" n={1} title={t("specifications")} meta={product.partNumber} className="mb-7" />
          <SpecSheet
            rows={specRows}
            partNumber={product.partNumber}
            labels={{ figure: t("figure"), drawing: t("drawing"), dimensions: t("dimensions"), table: t("specifications") }}
          />
        </section>

        <section aria-labelledby="compat-heading">
          <SheetHeading id="compat-heading" n={2} title={t("compatibleVehicles")} className="mb-7" />
          <FitmentList productId={product.id} universal={product.fitment === "universal"} {...(ctx.hasVehicle ? { selection: ctx.vehicle } : {})} />
        </section>

        <section aria-labelledby="details-heading">
          <SheetHeading id="details-heading" n={3} title={t("description")} className="mb-7" />
          <Markdown source={localize(product.description, locale)} baseLevel={3} linkAs={Link} className="max-w-prose" />
        </section>

        <section id="reviews" aria-labelledby="reviews-heading" className="scroll-mt-32">
          <SheetHeading id="reviews-heading" n={4} title={t("reviews")} className="mb-8" />
          <Suspense
            fallback={
              <div className="grid gap-10 lg:grid-cols-[18rem_1fr]">
                <Skeleton className="h-40" />
                <Skeleton className="h-64" />
              </div>
            }
          >
            <ProductReviews
              productId={product.id}
              slug={slug}
              locale={locale}
              user={ctx.user}
              average={product.ratingAverage}
              count={product.ratingCount}
              breakdown={detail.ratingBreakdown}
              sort={rsort}
              page={rpage}
            />
          </Suspense>
        </section>

        {detail.related.length > 0 ? (
          <section aria-labelledby="related-heading">
            <SheetHeading id="related-heading" n={5} title={t("related")} className="mb-8" />
            <ProductGrid className="md:grid-cols-4">
              {detail.related.slice(0, 4).map((p) => (
                <ProductCard key={p.id} product={p} locale={locale} currency={ctx.currency} signedIn={Boolean(ctx.user)} inWishlist={ctx.wishlistIds.has(p.id)} />
              ))}
            </ProductGrid>
          </section>
        ) : null}
      </div>
    </>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { EngineTeardown } from "@/components/engine3d";
import { HeroSheet } from "@/components/store/home/HeroSheet";
import { BestSellerRanking, BrandIndex, CategoryIndex, DealsList, NewArrivals, PromoBanners } from "@/components/store/home/sections";
import { getStoreContext } from "@/components/store/shared/context";
import { withFitFlags } from "@/components/store/shared/fit";
import { pageMetadata } from "@/components/store/shared/seo";
import { brand } from "@/config/brand";
import { isLocale } from "@/i18n/routing";
import { getActiveBanners } from "@/lib/services/banners";
import { getBestSellers, getCategoryTree, getDeals, getNewArrivals, listBrands } from "@/lib/services/catalog";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return pageMetadata({
    locale,
    path: "",
    title: { absolute: `${brand.fullName} | ${brand.tagline[locale]}` },
    description: brand.description[locale],
  });
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const ctx = await getStoreContext(locale);
  const [promoBanners, tree, deals, arrivals, bestSellers, brands] = await Promise.all([
    getActiveBanners("home_promo"),
    getCategoryTree(),
    getDeals(6),
    getNewArrivals(12),
    getBestSellers(12),
    listBrands({ featuredOnly: true }),
  ]);
  // One product appears once on the page: deals first, then the ranking, then new arrivals.
  const seen = new Set(deals.map((p) => p.id));
  const bestUnique = bestSellers.filter((p) => !seen.has(p.id)).slice(0, 5);
  bestUnique.forEach((p) => seen.add(p.id));
  const newUnique = arrivals.filter((p) => !seen.has(p.id)).slice(0, 5);
  const [dealsFit, bestFit, arrivalsFit] = await Promise.all([withFitFlags(deals, ctx), withFitFlags(bestUnique, ctx), withFitFlags(newUnique, ctx)]);
  const categories = tree.filter((c) => c.isActive && c.productCount > 0);

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brand.fullName,
    description: brand.description[locale],
    email: brand.contact.email,
    telephone: brand.contact.phone,
    sameAs: Object.values(brand.socials),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organization).replace(/</g, "\\u003c") }} />
      <HeroSheet ctx={ctx} />

      <div className="mt-16 space-y-20 md:mt-24 md:space-y-28">
        <CategoryIndex categories={categories} locale={locale} />
        <EngineTeardown />
        <DealsList products={dealsFit} ctx={ctx} />
        <PromoBanners banners={dealsFit.length > 0 ? promoBanners.filter((b) => b.ctaHref !== "/deals") : promoBanners} locale={locale} />
        <BestSellerRanking products={bestFit} ctx={ctx} />
        <NewArrivals products={arrivalsFit} ctx={ctx} />
        <BrandIndex brands={brands} locale={locale} />
      </div>
    </>
  );
}

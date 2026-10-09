import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui";
import { CatalogHero } from "@/components/store/catalog/CatalogHero";
import { pageMetadata } from "@/components/store/shared/seo";
import { Link } from "@/i18n/navigation";
import { isLocale } from "@/i18n/routing";
import { localize } from "@/lib/i18n-string";
import { listBrands } from "@/lib/services/catalog";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "store.brands" });
  return pageMetadata({ locale, path: "/brands", title: t("metaTitle"), description: t("metaDescription") });
}

export default async function BrandsPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("store.brands");
  const brands = (await listBrands()).filter((b) => b.productCount > 0);
  const featured = brands.filter((b) => b.isFeatured);
  const rest = brands.filter((b) => !b.isFeatured);

  const card = (b: (typeof brands)[number]) => (
    <li key={b.id}>
      <Link
        href={`/brand/${b.slug}`}
        className="group flex h-full flex-col overflow-hidden rounded-md border border-border bg-surface transition-[border-color,box-shadow] duration-200 hover:border-border-strong hover:shadow-md"
      >
        {b.logo ? <Image src={b.logo} alt="" width={480} height={200} unoptimized className="aspect-[12/5] w-full object-cover" /> : <div className="aspect-[12/5] bg-inverse" />}
        <div className="flex flex-1 flex-col gap-1 p-4">
          <p className="font-display text-xl font-bold uppercase leading-tight group-hover:text-primary-text">{b.name}</p>
          <p className="line-clamp-2 text-sm text-muted">{localize(b.description, locale)}</p>
          <p className="num mt-auto pt-2 text-[0.8125rem] font-medium text-subtle">{t("parts", { count: b.productCount })}</p>
        </div>
      </Link>
    </li>
  );

  return (
    <>
      <div className="container-page pb-4 pt-5">
        <Breadcrumbs linkAs={Link} items={[{ label: t("home"), href: "/" }, { label: t("title") }]} />
      </div>
      <CatalogHero title={t("title")} description={t("description")} />
      <div className="container-page space-y-14 py-10 md:py-14">
        {featured.length > 0 ? (
          <section aria-labelledby="brands-featured">
            <h2 id="brands-featured" className="display-3">
              {t("featured")}
            </h2>
            <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{featured.map(card)}</ul>
          </section>
        ) : null}
        {rest.length > 0 ? (
          <section aria-labelledby="brands-all">
            <h2 id="brands-all" className="display-3">
              {t("all")}
            </h2>
            <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{rest.map(card)}</ul>
          </section>
        ) : null}
      </div>
    </>
  );
}

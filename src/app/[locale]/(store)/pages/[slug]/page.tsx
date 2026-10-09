import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/ui";
import { Markdown } from "@/components/ui/Markdown";
import { clampDescription, pageMetadata } from "@/components/store/shared/seo";
import { Link } from "@/i18n/navigation";
import { isLocale } from "@/i18n/routing";
import { localize } from "@/lib/i18n-string";
import { getPageBySlug, listFooterPages } from "@/lib/services/cms";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ locale: string; slug: string }> };

function plainText(markdown: string): string {
  return markdown
    .replace(/^#{1,4}\s.*$/gm, "")
    .replace(/\|.*\|/g, "")
    .replace(/[*_`>#-]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const page = await getPageBySlug(slug);
  if (!page) return {};
  const description = clampDescription(localize(page.seoDescription, locale) || plainText(localize(page.body, locale)));
  return pageMetadata({ locale, path: `/pages/${slug}`, title: localize(page.title, locale), description });
}

export default async function CmsPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const page = await getPageBySlug(slug);
  if (!page) notFound();
  const [t, others, format] = await Promise.all([getTranslations("store.cms"), listFooterPages(), getFormatter({ locale })]);
  const title = localize(page.title, locale);

  return (
    <div className="container-page py-8 md:py-12">
      <Breadcrumbs linkAs={Link} items={[{ label: t("home"), href: "/" }, { label: title }]} />
      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[14rem_minmax(0,46rem)] lg:gap-16">
        <nav aria-label={t("pagesNav")} className="lg:sticky lg:top-32 lg:self-start">
          <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-0.5">
            {others.map((p) => {
              const current = p.slug === slug;
              return (
                <li key={p.slug}>
                  <Link
                    href={`/pages/${p.slug}`}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex min-h-10 items-center rounded-sm px-3 text-[0.9375rem] font-medium transition-colors",
                      current ? "bg-secondary text-secondary-foreground" : "text-muted hover:bg-surface-sunken hover:text-foreground",
                    )}
                  >
                    {localize(p.title, locale)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <article>
          <h1 className="display-1 text-[clamp(2.25rem,1.4rem+3.6vw,4rem)]">{title}</h1>
          <p className="mt-3 text-sm text-muted">{t("updated", { date: format.dateTime(new Date(page.updatedAt), { dateStyle: "long" }) })}</p>
          <div className="ruler mt-6" aria-hidden />
          <Markdown source={localize(page.body, locale)} linkAs={Link} className="mt-8" />
        </article>
      </div>
    </div>
  );
}

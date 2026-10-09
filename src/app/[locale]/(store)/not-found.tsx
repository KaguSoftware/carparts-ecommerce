import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { NotFoundSheet } from "@/components/shared/NotFoundSheet";
import { buttonStyles } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { getCategoryTree } from "@/lib/services/catalog";
import { localize } from "@/lib/i18n-string";
import { getLocale } from "next-intl/server";

/** 404 inside the storefront shell: header and footer stay, and we point people at real destinations. */
export default async function StoreNotFound() {
  const [t, locale, tree] = await Promise.all([getTranslations("store.notFound"), getLocale(), getCategoryTree()]);
  return (
    <div className="container-page py-16 md:py-24">
      <div className="max-w-3xl">
        <NotFoundSheet code="404" status={t("status")} drawing={t("drawing")}>
          <h1 className="display-2">{t("title")}</h1>
          <p className="max-w-prose text-[1.0625rem] text-muted">{t("description")}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/" className={buttonStyles({ variant: "primary", size: "lg" })}>
              {t("home")}
            </Link>
            <Link href="/search" className={buttonStyles({ variant: "outline", size: "lg" })}>
              {t("search")}
            </Link>
            <Link href="/contact" className={buttonStyles({ variant: "ghost", size: "lg" })}>
              {t("contact")}
            </Link>
          </div>
        </NotFoundSheet>
      </div>
      <section className="mt-16" aria-labelledby="nf-categories">
        <h2 id="nf-categories" className="display-4">
          {t("browse")}
        </h2>
        <ol className="mt-4 grid gap-x-10 border-t-2 border-foreground sm:grid-cols-2 lg:grid-cols-3">
          {tree
            .filter((c) => c.isActive && c.productCount > 0)
            .map((c, i) => (
              <li key={c.slug} className="border-b border-border">
                <Link href={`/category/${c.slug}`} className="group flex min-h-12 items-baseline gap-3 py-3">
                  <span className="mono w-6 shrink-0 text-[0.75rem] font-medium text-subtle">{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-display text-xl font-bold uppercase tracking-wide group-hover:text-primary-text">{localize(c.name, locale)}</span>
                  <span aria-hidden className="mb-1 min-w-4 flex-1 self-end border-b-2 border-dotted border-border-strong" />
                  <ArrowRight className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
        </ol>
      </section>
    </div>
  );
}

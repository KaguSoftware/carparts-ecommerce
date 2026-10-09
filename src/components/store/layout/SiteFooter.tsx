import { getLocale, getTranslations } from "next-intl/server";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { LocaleSwitcher } from "@/components/shared/LocaleSwitcher";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { brand } from "@/config/brand";
import { Link } from "@/i18n/navigation";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/routing";
import { localize } from "@/lib/i18n-string";
import { listFooterPages } from "@/lib/services/cms";
import { getCategoryTree } from "@/lib/services/catalog";
import { getPublicSettings } from "@/lib/services/settings";
import { NewsletterForm } from "./NewsletterForm";

const linkClass = "inline-flex min-h-8 items-center text-[0.9375rem] text-inverse-muted underline-offset-4 transition-colors hover:text-inverse-foreground hover:underline";

export async function SiteFooter() {
  const raw = await getLocale();
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getTranslations("store.footer");
  const [tree, pages, settings] = await Promise.all([getCategoryTree(), listFooterPages(), getPublicSettings()]);
  const { store } = settings;
  const year = new Date().getUTCFullYear();
  const socials = Object.entries(settings.social).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0);

  return (
    <footer className="mt-24 bg-inverse text-inverse-foreground">
      <div className="border-b border-inverse-border">
        <div className="container-page grid gap-8 py-12 md:grid-cols-[1.1fr_1fr] md:items-center md:py-14">
          <div>
            <h2 className="display-3 max-w-md">{t("newsletterTitle")}</h2>
            <p className="mt-2 max-w-md text-inverse-muted">{t("newsletterBody")}</p>
          </div>
          <NewsletterForm source="footer" />
        </div>
      </div>

      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.25fr_1fr_1fr_1fr]">
        <div className="space-y-5">
          <Link href="/" aria-label={t("home")} className="inline-flex">
            <Logo variant="dark" height={44} title="" />
          </Link>
          <p className="max-w-xs text-[0.9375rem] text-inverse-muted">{brand.description[locale]}</p>
          <ul className="space-y-2.5 text-[0.9375rem] text-inverse-muted">
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <address className="not-italic">
                {store.address.line1}, {store.address.city}, {store.address.region} {store.address.postalCode}
              </address>
            </li>
            <li className="flex items-center gap-2.5">
              <Phone className="size-4 shrink-0 text-primary" aria-hidden />
              <a href={`tel:${store.phone.replace(/[^+\d]/g, "")}`} className="num hover:text-inverse-foreground hover:underline">
                {store.phone}
              </a>
            </li>
            <li className="flex items-center gap-2.5">
              <Mail className="size-4 shrink-0 text-primary" aria-hidden />
              <a href={`mailto:${store.email}`} className="hover:text-inverse-foreground hover:underline">
                {store.email}
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <Clock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>{brand.contact.hours[locale]}</span>
            </li>
          </ul>
        </div>

        <nav aria-labelledby="footer-shop">
          <h2 id="footer-shop" className="label-caps text-inverse-foreground">
            {t("shop")}
          </h2>
          <ul className="mt-3 space-y-0.5">
            {tree
              .filter((c) => c.isActive && c.productCount > 0)
              .map((c) => (
                <li key={c.slug}>
                  <Link href={`/category/${c.slug}`} className={linkClass}>
                    {localize(c.name, locale)}
                  </Link>
                </li>
              ))}
            <li>
              <Link href="/brands" className={linkClass}>
                {t("brands")}
              </Link>
            </li>
            <li>
              <Link href="/deals" className={linkClass}>
                {t("deals")}
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-labelledby="footer-help">
          <h2 id="footer-help" className="label-caps text-inverse-foreground">
            {t("help")}
          </h2>
          <ul className="mt-3 space-y-0.5">
            <li>
              <Link href="/track-order" className={linkClass}>
                {t("trackOrder")}
              </Link>
            </li>
            <li>
              <Link href="/contact" className={linkClass}>
                {t("contact")}
              </Link>
            </li>
            <li>
              <Link href="/garage" className={linkClass}>
                {t("garage")}
              </Link>
            </li>
            <li>
              <Link href="/account" className={linkClass}>
                {t("account")}
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-labelledby="footer-company">
          <h2 id="footer-company" className="label-caps text-inverse-foreground">
            {t("company")}
          </h2>
          <ul className="mt-3 space-y-0.5">
            {pages.map((p) => (
              <li key={p.slug}>
                <Link href={`/pages/${p.slug}`} className={linkClass}>
                  {localize(p.title, locale)}
                </Link>
              </li>
            ))}
          </ul>
          {socials.length ? (
            <>
              <h2 className="label-caps mt-7 text-inverse-foreground">{t("follow")}</h2>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {socials.map(([key, url]) => (
                  <li key={key}>
                    <a href={url} rel="noopener noreferrer" target="_blank" className={linkClass}>
                      {t(`social.${key}`)}
                      <span className="sr-only"> {t("opensInNewTab")}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </nav>
      </div>

      <div className="border-t border-inverse-border">
        <div className="container-page flex flex-col gap-4 py-5 text-[0.8125rem] text-inverse-muted md:flex-row md:items-center md:justify-between">
          <p>{t("copyright", { year, name: brand.legalEntity })}</p>
          <dl className="mono grid grid-cols-3 border border-inverse-border text-[0.6875rem] uppercase tracking-[0.1em]" aria-label={t("titleBlock.label")}>
            <div className="border-r border-inverse-border px-3 py-1.5">
              <dt className="text-inverse-muted">{t("titleBlock.dwg")}</dt>
              <dd className="font-semibold text-inverse-foreground">{brand.name}</dd>
            </div>
            <div className="border-r border-inverse-border px-3 py-1.5">
              <dt className="text-inverse-muted">{t("titleBlock.sheet")}</dt>
              <dd className="font-semibold text-inverse-foreground">01 / 01</dd>
            </div>
            <div className="px-3 py-1.5">
              <dt className="text-inverse-muted">{t("titleBlock.rev")}</dt>
              <dd className="font-semibold text-inverse-foreground">{year}</dd>
            </div>
          </dl>
          <div className="flex items-center gap-1 text-inverse-foreground">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  );
}

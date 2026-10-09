import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LockKeyhole } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { LocaleSwitcher } from "@/components/shared/LocaleSwitcher";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Link } from "@/i18n/navigation";
import { isLocale } from "@/i18n/routing";

/** Checkout shell: logo, "secure checkout" badge and a way back to the cart. No navigation or footer links to distract. */
export default async function CheckoutLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("checkout.header");

  return (
    <>
      <a href="#main" className="skip-link">
        {t("skipToContent")}
      </a>
      <header className="border-b border-border bg-surface">
        <div className="container-page flex h-[var(--header-h)] items-center justify-between gap-4">
          <Link href="/" aria-label={t("home")} className="shrink-0">
            <Logo height={34} />
          </Link>
          <p className="label-caps hidden items-center gap-2 text-muted sm:flex">
            <LockKeyhole className="size-4 text-success" aria-hidden />
            {t("secure")}
          </p>
          <div className="flex items-center gap-1">
            <Link href="/cart" className="hidden h-10 items-center rounded-sm px-3 text-sm font-medium text-muted underline-offset-4 hover:text-foreground hover:underline sm:inline-flex">
              {t("backToCart")}
            </Link>
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <footer className="border-t border-border py-8">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <p>{t("footer", { year: new Date().getUTCFullYear() })}</p>
          <nav aria-label={t("legal")} className="flex gap-5">
            <Link href="/pages/returns" className="underline-offset-4 hover:text-foreground hover:underline">
              {t("returns")}
            </Link>
            <Link href="/pages/privacy" className="underline-offset-4 hover:text-foreground hover:underline">
              {t("privacy")}
            </Link>
            <Link href="/contact" className="underline-offset-4 hover:text-foreground hover:underline">
              {t("help")}
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}

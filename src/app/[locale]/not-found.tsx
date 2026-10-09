import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/brand/Logo";
import { NotFoundSheet } from "@/components/shared/NotFoundSheet";
import { buttonStyles } from "@/components/ui/Button";

export default async function NotFound() {
  const t = await getTranslations("pages.notFound");
  return (
    <main id="main" className="container-page flex min-h-dvh flex-col items-center justify-center gap-8 py-16 text-center">
      <Link href="/" aria-label="APEXLINE Auto Parts">
        <Logo height={44} title="" />
      </Link>
      <div className="w-full max-w-3xl text-left">
        <NotFoundSheet code="404" status={t("status")} drawing={t("drawing")}>
          <h1 className="display-2">{t("title")}</h1>
          <p className="max-w-prose text-muted">{t("description")}</p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link href="/" className={buttonStyles({ variant: "primary" })}>
              {t("home")}
            </Link>
            <Link href="/search" className={buttonStyles({ variant: "outline" })}>
              {t("search")}
            </Link>
          </div>
        </NotFoundSheet>
      </div>
    </main>
  );
}

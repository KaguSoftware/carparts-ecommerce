"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button, buttonStyles } from "@/components/ui/Button";

export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("pages.error");

  useEffect(() => {
    console.error("[ui] unhandled render error", error);
  }, [error]);

  return (
    <main id="main" className="container-page flex min-h-[70dvh] flex-col items-center justify-center gap-6 py-16 text-center">
      <h1 className="display-2">{t("title")}</h1>
      <p className="max-w-prose text-muted">{t("description")}</p>
      {error.digest ? <p className="num text-xs text-subtle">{t("reference", { digest: error.digest })}</p> : null}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>{t("retry")}</Button>
        <Link href="/" className={buttonStyles({ variant: "outline" })}>
          {t("home")}
        </Link>
      </div>
    </main>
  );
}

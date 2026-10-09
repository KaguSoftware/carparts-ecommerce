"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui";
import { Link } from "@/i18n/navigation";

/** Error boundary for storefront routes: the header and footer stay mounted, only the page body is replaced. */
export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("store.error");

  useEffect(() => {
    console.error("[store] unhandled render error", error);
  }, [error]);

  return (
    <div className="container-page flex min-h-[55dvh] flex-col items-start justify-center gap-5 py-16">
      <TriangleAlert className="size-10 text-warning" strokeWidth={1.5} aria-hidden />
      <h1 className="display-2">{t("title")}</h1>
      <p className="max-w-prose text-[1.0625rem] text-muted">{t("description")}</p>
      {error.digest ? <p className="num text-xs text-subtle">{t("reference", { digest: error.digest })}</p> : null}
      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={reset}>
          {t("retry")}
        </Button>
        <Link href="/" className={buttonStyles({ variant: "outline", size: "lg" })}>
          {t("home")}
        </Link>
        <Link href="/contact" className={buttonStyles({ variant: "ghost", size: "lg" })}>
          {t("contact")}
        </Link>
      </div>
    </div>
  );
}

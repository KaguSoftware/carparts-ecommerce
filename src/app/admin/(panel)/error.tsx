"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

/** Error boundary for admin pages. The digest lets ops find the matching server log line. */
export default function PanelError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("admin.shell");
  return (
    <div className="mx-auto max-w-lg py-16">
      <Alert tone="danger" title={t("errorTitle")}>
        {t("errorBody")}
        {error.digest ? <span className="num mt-1 block text-xs text-muted">{t("reference", { digest: error.digest })}</span> : null}
      </Alert>
      <div className="mt-4 flex items-center gap-3">
        <Button type="button" variant="secondary" onClick={reset}>
          {t("retry")}
        </Button>
        <Link href="/admin" className="text-sm text-primary-text underline underline-offset-4">
          {t("backToDashboard")}
        </Link>
      </div>
    </div>
  );
}

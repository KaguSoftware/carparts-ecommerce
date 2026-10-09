"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { setAdminLocaleAction } from "@/actions/admin/auth";
import { LOCALES, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/** Admin language switch: writes the `admin_locale` cookie (admin URLs carry no locale segment) and re-renders. */
export function AdminLocaleSwitch({ className }: { className?: string }) {
  const t = useTranslations("common.locale");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className={cn("inline-flex items-center gap-1", className)} role="group" aria-label={t("label")}>
      <Languages className="mr-1 size-4 opacity-70" aria-hidden />
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          disabled={pending}
          aria-pressed={l === locale}
          onClick={() => {
            if (l === locale) return;
            startTransition(async () => {
              await setAdminLocaleAction(l);
              router.refresh();
            });
          }}
          className={cn("label-caps rounded-xs px-2 py-1.5 text-[0.8125rem] transition-colors", l === locale ? "bg-current/15 text-current" : "opacity-70 hover:opacity-100")}
        >
          <span aria-hidden>{l.toUpperCase()}</span>
          <span className="sr-only">{t(l)}</span>
        </button>
      ))}
    </div>
  );
}

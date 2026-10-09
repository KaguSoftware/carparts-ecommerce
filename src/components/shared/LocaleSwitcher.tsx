"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { Languages } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALES, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/**
 * STOREFRONT language switcher: swaps the /{locale} URL prefix and keeps the current page + query.
 * (The admin panel has its own switcher that writes the `admin_locale` cookie.)
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("common.locale");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
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
            startTransition(() => {
              // `params` contains dynamic segments (e.g. slug) so the typed pathname stays valid.
              // Query keeps repeated params as arrays; hash is re-appended after navigation settles.
              const query: Record<string, string | string[]> = {};
              const searchParams = new URLSearchParams(window.location.search); // read on click: useSearchParams() would force every page using the header into client rendering
              for (const key of new Set(searchParams.keys())) {
                const all = searchParams.getAll(key);
                query[key] = all.length > 1 ? all : all[0];
              }
              const hash = window.location.hash;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              router.replace({ pathname, params, query } as any, { locale: l });
              if (hash) {
                requestAnimationFrame(() => {
                  if (!window.location.hash) window.location.hash = hash;
                });
              }
            });
          }}
          className={cn(
            "label-caps rounded-xs px-2 py-1.5 text-[0.8125rem] transition-colors",
            l === locale ? "bg-current/15 text-current" : "opacity-70 hover:opacity-100",
          )}
        >
          <span aria-hidden>{l.toUpperCase()}</span>
          <span className="sr-only">{t(l)}</span>
        </button>
      ))}
    </div>
  );
}

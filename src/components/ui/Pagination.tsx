import type { LinkAs as LinkAsType } from "./link-as";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PaginationProps {
  page: number;
  pageCount: number;
  /** Build the URL for a given page number, e.g. (p) => `/en/shop?${qs(p)}`. */
  buildHref: (page: number) => string;
  /**
   * Link component. Storefront: pass `Link` from "@/i18n/navigation" (then buildHref returns an
   * UNPREFIXED path). Admin: pass `next/link`. Default: <a>.
   */
  linkAs?: LinkAsType;
  /** Pages shown on each side of the current page. */
  siblings?: number;
  className?: string;
}

function range(page: number, pageCount: number, siblings: number): (number | "gap")[] {
  const out: (number | "gap")[] = [];
  const start = Math.max(2, page - siblings);
  const end = Math.min(pageCount - 1, page + siblings);
  out.push(1);
  if (start > 2) out.push("gap");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < pageCount - 1) out.push("gap");
  if (pageCount > 1) out.push(pageCount);
  return out;
}

const itemBase =
  "inline-flex h-10 min-w-10 items-center justify-center rounded-sm border px-2.5 text-sm font-medium transition-colors num";

export function Pagination({ page, pageCount, buildHref, linkAs: LinkAs = "a", siblings = 1, className }: PaginationProps) {
  const t = useTranslations("ui.pagination");
  if (pageCount <= 1) return null;
  const items = range(page, pageCount, siblings);
  const prev = page > 1 ? page - 1 : null;
  const next = page < pageCount ? page + 1 : null;

  return (
    <nav aria-label={t("label")} className={cn("flex flex-wrap items-center justify-center gap-1.5", className)}>
      {prev ? (
        <LinkAs href={buildHref(prev)} rel="prev" className={cn(itemBase, "gap-1 border-border-strong hover:bg-surface-sunken")}>
          <ChevronLeft className="size-4" aria-hidden />
          <span className="hidden sm:inline">{t("previous")}</span>
          <span className="sr-only sm:hidden">{t("previous")}</span>
        </LinkAs>
      ) : (
        <span aria-disabled className={cn(itemBase, "cursor-not-allowed gap-1 border-border text-subtle")}>
          <ChevronLeft className="size-4" aria-hidden />
          <span className="hidden sm:inline">{t("previous")}</span>
        </span>
      )}

      <ul className="flex items-center gap-1.5">
        {items.map((it, i) =>
          it === "gap" ? (
            <li key={`gap-${i}`} aria-hidden className="px-1 text-subtle">
              &hellip;
            </li>
          ) : (
            <li key={it}>
              {it === page ? (
                <span aria-current="page" aria-label={t("page", { page: it })} className={cn(itemBase, "border-primary bg-primary text-primary-foreground")}>
                  {it}
                </span>
              ) : (
                <LinkAs href={buildHref(it)} aria-label={t("page", { page: it })} className={cn(itemBase, "border-border-strong hover:bg-surface-sunken")}>
                  {it}
                </LinkAs>
              )}
            </li>
          ),
        )}
      </ul>

      {next ? (
        <LinkAs href={buildHref(next)} rel="next" className={cn(itemBase, "gap-1 border-border-strong hover:bg-surface-sunken")}>
          <span className="hidden sm:inline">{t("next")}</span>
          <span className="sr-only sm:hidden">{t("next")}</span>
          <ChevronRight className="size-4" aria-hidden />
        </LinkAs>
      ) : (
        <span aria-disabled className={cn(itemBase, "cursor-not-allowed gap-1 border-border text-subtle")}>
          <span className="hidden sm:inline">{t("next")}</span>
          <ChevronRight className="size-4" aria-hidden />
        </span>
      )}
    </nav>
  );
}

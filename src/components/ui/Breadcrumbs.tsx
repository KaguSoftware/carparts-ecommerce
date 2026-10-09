import { Fragment, type ReactNode } from "react";
import type { LinkAs as LinkAsType } from "./link-as";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: ReactNode;
  /** Omit on the current (last) page. */
  href?: string;
}

export interface BreadcrumbsProps {
  items: Crumb[];
  /** Link component: storefront `Link` from "@/i18n/navigation", admin `next/link`. Default <a>. */
  linkAs?: LinkAsType;
  className?: string;
}

export function Breadcrumbs({ items, linkAs: LinkAs = "a", className }: BreadcrumbsProps) {
  const t = useTranslations("ui.breadcrumbs");
  if (items.length === 0) return null;
  return (
    <nav aria-label={t("label")} className={className}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <Fragment key={i}>
              <li className="flex items-center">
                {item.href && !last ? (
                  <LinkAs href={item.href} className="rounded-xs underline-offset-4 hover:text-foreground hover:underline">
                    {item.label}
                  </LinkAs>
                ) : (
                  <span aria-current={last ? "page" : undefined} className={cn(last && "font-medium text-foreground")}>
                    {item.label}
                  </span>
                )}
              </li>
              {!last ? (
                <li aria-hidden className="flex items-center text-subtle">
                  <ChevronRight className="size-3.5" />
                </li>
              ) : null}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

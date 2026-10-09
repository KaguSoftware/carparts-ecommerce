"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, BadgePercent } from "lucide-react";
import Image from "next/image";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { NavCategory } from "./nav-types";

/**
 * Desktop category navigation with a mega-menu per top-level category.
 * Disclosure pattern: hover or keyboard focus opens the panel, Escape closes it, Tab walks into it.
 */
export function MegaNav({ categories }: { categories: NavCategory[] }) {
  const t = useTranslations("store.nav");
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  const cancelClose = () => window.clearTimeout(closeTimer.current);
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(null), 140);
  };

  return (
    <nav aria-label={t("categories")} className="hidden lg:block">
      <ul className="flex items-stretch">
        {categories.map((cat) => {
          const isOpen = open === cat.slug;
          const current = pathname === `/category/${cat.slug}`;
          const panelId = `mega-${cat.slug}`;
          return (
            <li
              key={cat.slug}
              onPointerEnter={(e) => {
                if (e.pointerType !== "mouse") return;
                cancelClose();
                setOpen(cat.slug);
              }}
              onPointerLeave={(e) => {
                if (e.pointerType === "mouse") scheduleClose();
              }}
              onFocus={() => {
                cancelClose();
                setOpen(cat.slug);
              }}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen((cur) => (cur === cat.slug ? null : cur));
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape" && isOpen) {
                  setOpen(null);
                  (e.currentTarget.querySelector("a") as HTMLElement | null)?.focus();
                }
              }}
            >
              <Link
                href={`/category/${cat.slug}`}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "relative flex h-11 items-center px-3 font-display text-[0.9375rem] font-semibold uppercase tracking-[0.07em] text-inverse-foreground/85 transition-colors hover:text-inverse-foreground focus-visible:text-inverse-foreground",
                  "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-200",
                  (isOpen || current) && "text-inverse-foreground after:scale-x-100",
                )}
              >
                {cat.name}
              </Link>
              <div
                id={panelId}
                hidden={!isOpen}
                onClick={() => setOpen(null)}
                className="absolute inset-x-0 top-full z-40 border-b border-border bg-surface-raised text-foreground shadow-lg"
              >
                <div className="container-page grid gap-8 py-7 lg:grid-cols-[1fr_17rem]">
                  <div>
                    <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
                      <p className="display-4">{cat.name}</p>
                      <Link href={`/category/${cat.slug}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-text hover:underline">
                        {t("shopAll", { name: cat.name })}
                        <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    </div>
                    <ul className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 xl:grid-cols-3">
                      {cat.children.map((child) => (
                        <li key={child.slug}>
                          <Link href={`/category/${child.slug}`} className="group flex items-baseline justify-between gap-3 rounded-xs py-2 text-[0.9375rem] text-foreground hover:text-primary-text">
                            <span className="group-hover:underline group-hover:underline-offset-4">{child.name}</span>
                            <span className="num text-[0.8125rem] text-subtle">{child.count}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {cat.image ? (
                    <Link href={`/category/${cat.slug}`} tabIndex={-1} aria-hidden className="relative hidden aspect-[4/3] overflow-hidden rounded-md border border-border lg:block">
                      <Image src={cat.image} alt="" fill sizes="272px" unoptimized className="object-cover" />
                    </Link>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Right-hand quick links of the nav bar (deals, brands). */
export function NavQuickLinks() {
  const t = useTranslations("store.nav");
  const pathname = usePathname();
  const base =
    "flex h-11 items-center gap-1.5 px-3 font-display text-[0.9375rem] font-semibold uppercase tracking-[0.07em] transition-colors";
  return (
    <ul className="hidden items-stretch lg:flex">
      <li>
        <Link href="/deals" aria-current={pathname === "/deals" ? "page" : undefined} className={cn(base, "text-accent hover:text-inverse-foreground")}>
          <BadgePercent className="size-4.5" aria-hidden />
          {t("deals")}
        </Link>
      </li>
      <li>
        <Link href="/brands" aria-current={pathname === "/brands" ? "page" : undefined} className={cn(base, "text-inverse-foreground/85 hover:text-inverse-foreground")}>
          {t("brands")}
        </Link>
      </li>
    </ul>
  );
}

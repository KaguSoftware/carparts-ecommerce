"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BadgePercent, CarFront, ChevronDown, Menu, PackageSearch, Store, UserRound } from "lucide-react";
import { Modal } from "@/components/ui";
import { LocaleSwitcher } from "@/components/shared/LocaleSwitcher";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Link } from "@/i18n/navigation";
import type { NavCategory } from "./nav-types";

const rowLink = "flex min-h-12 items-center gap-3 rounded-sm px-2 text-[1.0625rem] font-medium text-foreground hover:bg-surface-sunken";

export function MobileNav({ categories, signedIn }: { categories: NavCategory[]; signedIn: boolean }) {
  const t = useTranslations("store.nav");
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={t("openMenu")}
        className="inline-flex size-11 items-center justify-center rounded-sm text-current transition-colors hover:bg-current/10 lg:hidden"
      >
        <Menu className="size-6" aria-hidden />
      </button>
      <Modal open={open} onClose={close} placement="left" title={t("menu")}>
        <nav aria-label={t("mobile")} className="-mx-2 flex flex-col">
          <ul className="flex flex-col">
            <li>
              <Link href="/garage" onClick={close} className={rowLink}>
                <CarFront className="size-5 text-primary-text" aria-hidden />
                {t("garage")}
              </Link>
            </li>
            <li>
              <Link href="/deals" onClick={close} className={rowLink}>
                <BadgePercent className="size-5 text-primary-text" aria-hidden />
                {t("deals")}
              </Link>
            </li>
            <li>
              <Link href="/brands" onClick={close} className={rowLink}>
                <Store className="size-5 text-primary-text" aria-hidden />
                {t("brands")}
              </Link>
            </li>
          </ul>

          <p className="label-caps mt-5 px-2 pb-2 text-muted">{t("categories")}</p>
          <ul className="flex flex-col border-t border-border">
            {categories.map((cat) => (
              <li key={cat.slug} className="border-b border-border">
                <details className="group">
                  <summary className="flex min-h-12 list-none items-center justify-between gap-3 px-2 text-[1.0625rem] font-medium [&::-webkit-details-marker]:hidden">
                    {cat.name}
                    <ChevronDown className="size-5 text-muted transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <ul className="pb-3 pl-4">
                    <li>
                      <Link href={`/category/${cat.slug}`} onClick={close} className="flex min-h-11 items-center px-2 text-[0.9375rem] font-semibold text-primary-text">
                        {t("shopAll", { name: cat.name })}
                      </Link>
                    </li>
                    {cat.children.map((child) => (
                      <li key={child.slug}>
                        <Link href={`/category/${child.slug}`} onClick={close} className="flex min-h-11 items-center justify-between gap-3 px-2 text-[0.9375rem] text-foreground hover:bg-surface-sunken">
                          {child.name}
                          <span className="num text-[0.8125rem] text-subtle">{child.count}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>

          <ul className="mt-5 flex flex-col">
            <li>
              <Link href={signedIn ? "/account" : "/login"} onClick={close} className={rowLink}>
                <UserRound className="size-5 text-muted" aria-hidden />
                {signedIn ? t("account") : t("signIn")}
              </Link>
            </li>
            <li>
              <Link href="/track-order" onClick={close} className={rowLink}>
                <PackageSearch className="size-5 text-muted" aria-hidden />
                {t("trackOrder")}
              </Link>
            </li>
          </ul>

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-border px-2 pt-4">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </nav>
      </Modal>
    </>
  );
}

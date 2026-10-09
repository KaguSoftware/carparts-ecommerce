"use client";

import { useTranslations } from "next-intl";
import { Heart, KeyRound, LayoutDashboard, MapPin, PackageSearch, Star, UserRound } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { SignOutButton } from "./SignOutButton";

const ITEMS = [
  { href: "/account", key: "overview", icon: LayoutDashboard, exact: true },
  { href: "/account/orders", key: "orders", icon: PackageSearch },
  { href: "/account/addresses", key: "addresses", icon: MapPin },
  { href: "/account/wishlist", key: "wishlist", icon: Heart },
  { href: "/account/reviews", key: "reviews", icon: Star },
  { href: "/account/profile", key: "profile", icon: UserRound },
  { href: "/account/security", key: "security", icon: KeyRound },
] as const;

/** Account sub-navigation: a horizontal scroller on phones, a vertical rail from `lg`. */
export function AccountNav() {
  const t = useTranslations("account.nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")} className="-mx-4 overflow-x-auto px-4 sm:-mx-0 sm:px-0 lg:overflow-visible">
      <ul className="flex gap-1 lg:flex-col">
        {ITEMS.map(({ href, key, icon: Icon, ...rest }) => {
          const exact = "exact" in rest && rest.exact;
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-2.5 rounded-sm px-3.5 text-[0.9375rem] font-medium transition-colors",
                  active ? "bg-secondary text-secondary-foreground" : "text-muted hover:bg-surface-sunken hover:text-foreground",
                )}
              >
                <Icon className="size-4.5 shrink-0" aria-hidden />
                {t(key)}
              </Link>
            </li>
          );
        })}
        <li className="hidden lg:mt-3 lg:block lg:border-t lg:border-border lg:pt-3">
          <SignOutButton className="w-full justify-start px-3.5" />
        </li>
      </ul>
    </nav>
  );
}

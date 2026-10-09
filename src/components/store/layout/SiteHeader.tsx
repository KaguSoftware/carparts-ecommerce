import type { CSSProperties } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Heart, UserRound } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { PreferencesMenu } from "@/components/shared/PreferencesMenu";
import { Link } from "@/i18n/navigation";
import { isLocale, DEFAULT_LOCALE } from "@/i18n/routing";
import { getCartId } from "@/lib/session/cookies";
import { getActiveBanners } from "@/lib/services/banners";
import { peekCartItemCount } from "@/lib/services/cart";
import { getCategoryTree, listProducts } from "@/lib/services/catalog";
import { getPublicSettings } from "@/lib/services/settings";
import { localize } from "@/lib/i18n-string";
import { cn } from "@/lib/utils";
import { CartButton } from "../cart/CartButton";
import { CartDrawer } from "../cart/CartDrawer";
import { getStoreContext } from "../shared/context";
import { GarageButton } from "../vehicle/GarageButton";
import { HeaderAutoHide } from "./HeaderAutoHide";
import { MegaNav, NavQuickLinks } from "./MegaNav";
import { MobileNav } from "./MobileNav";
import type { NavCategory } from "./nav-types";
import { SearchBox } from "./SearchBox";

/**
 * Storefront header: announcement bar, logo, search with autocomplete, My Garage, account, cart and the category
 * mega-menu. Reused by the account layout; the checkout layout has its own minimal header.
 */
export async function SiteHeader() {
  const raw = await getLocale();
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getTranslations("store.header");
  const ctx = await getStoreContext(locale);

  const [tree, banners, settings, cartId] = await Promise.all([getCategoryTree(), getActiveBanners("announcement"), getPublicSettings(), getCartId()]);
  const cartCount = await peekCartItemCount({ cartId, userId: ctx.user?.id ?? null });
  const announcement = banners[0];
  const fitCount = ctx.hasVehicle ? (await listProducts({ vehicle: ctx.vehicle, pageSize: 1 })).total : undefined;

  const categories: NavCategory[] = tree
    .filter((c) => c.isActive && c.productCount > 0)
    .map((c) => ({
      slug: c.slug,
      name: localize(c.name, locale),
      ...(c.image ? { image: c.image } : {}),
      count: c.productCount,
      children: c.children.filter((k) => k.isActive && k.productCount > 0).map((k) => ({ slug: k.slug, name: localize(k.name, locale), count: k.productCount })),
    }));

  const iconLink = "inline-flex h-12 min-w-11 flex-col items-center justify-center gap-0.5 px-1.5 text-current transition-colors hover:bg-current/10";
  const iconLabel = "tag-mono hidden text-[0.5625rem] leading-none lg:block";

  return (
    <>
      <header
        data-site-header
        style={{ "--search-hide": "3.9rem" } as CSSProperties}
        className="sticky top-0 z-40 bg-inverse text-inverse-foreground shadow-md transition-[clip-path] duration-200 ease-out max-md:data-search-hidden:[clip-path:inset(0_0_var(--search-hide)_0)] max-md:data-search-hidden:after:absolute max-md:data-search-hidden:after:inset-x-0 max-md:data-search-hidden:after:bottom-[var(--search-hide)] max-md:data-search-hidden:after:h-px max-md:data-search-hidden:after:bg-inverse-border"
      >
        <HeaderAutoHide />
        <div className="container-page grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 py-2.5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-x-6 md:py-3">
          <div className="flex items-center gap-1.5">
            <MobileNav categories={categories} signedIn={Boolean(ctx.user)} />
            <Link href="/" aria-label={t("home")} className="inline-flex rounded-sm">
              <Logo variant="dark" height={40} title="" className="hidden sm:block" />
              <Logo variant="dark" layout="mark" height={36} title="" className="sm:hidden" />
            </Link>
          </div>

          <SearchBox locale={locale} currency={ctx.currency} className="col-span-2 row-start-2 md:col-span-1 md:col-start-2 md:row-start-1" />

          <div className="col-start-2 row-start-1 flex items-center justify-self-end md:col-start-3">
            <GarageButton label={ctx.vehicleLabel} selection={ctx.vehicle} {...(fitCount !== undefined ? { fitCount } : {})} className="mr-1" />
            <PreferencesMenu className="hidden md:block" />
            <Link href={ctx.user ? "/account/wishlist" : "/login"} className={cn(iconLink, "hidden sm:inline-flex")} aria-label={t("wishlist")}>
              <Heart className="size-6" aria-hidden />
              <span aria-hidden className={iconLabel}>
                {t("savedShort")}
              </span>
            </Link>
            <Link href={ctx.user ? "/account" : "/login"} className={iconLink} aria-label={ctx.user ? t("account") : t("signIn")}>
              <UserRound className="size-6" aria-hidden />
              <span aria-hidden className={iconLabel}>
                {ctx.user ? t("accountShort") : t("signInShort")}
              </span>
            </Link>
            <CartButton initialCount={cartCount} />
          </div>
        </div>

        <div className="relative hidden border-t border-inverse-border lg:block">
          <div className="container-page flex items-stretch justify-between">
            <MegaNav categories={categories} />
            <div className="flex min-w-0 flex-1 items-stretch justify-end">
              {announcement ? (
                <p className="tag-mono hidden min-w-0 items-center gap-2 whitespace-nowrap pr-4 text-inverse-muted xl:flex">
                  <span aria-hidden className="size-1.5 shrink-0 bg-primary" />
                  <span className="truncate">{localize(announcement.title, locale)}</span>
                </p>
              ) : null}
              <NavQuickLinks />
            </div>
          </div>
        </div>
        <CartDrawer locale={locale} currency={ctx.currency} freeShippingThreshold={settings.freeShippingThreshold} />
      </header>
    </>
  );
}

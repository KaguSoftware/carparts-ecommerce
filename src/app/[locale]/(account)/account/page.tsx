import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, MapPin, PackageSearch, ShieldCheck } from "lucide-react";
import { OrderCard } from "@/components/account/orders/OrderCard";
import { privatePageMetadata } from "@/components/account/seo";
import { AccountPageHeader } from "@/components/account/shell/PageHeader";
import { Alert, buttonStyles } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { getAccountSummary, getUserById } from "@/lib/services/accounts";
import { listOrdersForUser } from "@/lib/services/orders";
import { getCurrencyContext } from "@/lib/services/settings";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account.overview" });
  return privatePageMetadata(t("metaTitle"));
}

export default async function AccountOverviewPage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;
  const user = await requireUser(locale, "/account");
  const t = await getTranslations("account.overview");

  const [summary, account, recent, currency] = await Promise.all([
    getAccountSummary(user.id),
    getUserById(user.id),
    listOrdersForUser(user.id, { page: 1, pageSize: 3 }),
    getCurrencyContext(locale),
  ]);
  const firstName = user.name.split(/\s+/)[0] ?? user.name;

  const stats = [
    { href: "/account/orders", label: t("statOrders"), value: String(summary.orderCount) },
    { href: "/account/orders", label: t("statSpent"), value: formatMoney(summary.totalSpent, locale, currency) },
    { href: "/account/wishlist", label: t("statWishlist"), value: String(summary.wishlistCount) },
    { href: "/account/addresses", label: t("statAddresses"), value: String(summary.addressCount) },
  ];

  const shortcuts = [
    { href: "/account/orders", icon: PackageSearch, title: t("shortcutOrdersTitle"), body: t("shortcutOrdersBody") },
    { href: "/account/addresses", icon: MapPin, title: t("shortcutAddressesTitle"), body: t("shortcutAddressesBody") },
    { href: "/account/security", icon: ShieldCheck, title: t("shortcutSecurityTitle"), body: t("shortcutSecurityBody") },
  ];

  return (
    <>
      <AccountPageHeader title={t("greeting", { name: firstName })} description={t("subtitle")} />

      {account && !account.emailVerified ? (
        <Alert tone="warning" title={t("verifyTitle")} className="mb-8">
          <span>{t("verifyBody", { email: account.email })} </span>
          <Link href="/verify-email" className="font-medium underline underline-offset-4 hover:no-underline">
            {t("verifyCta")}
          </Link>
        </Alert>
      ) : null}

      <section aria-label={t("statsLabel")}>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="relative flex flex-col gap-1 bg-surface px-4 py-4 transition-colors focus-within:bg-surface-sunken hover:bg-surface-sunken sm:px-5">
              <dt>
                <Link href={stat.href} className="label-caps text-muted after:absolute after:inset-0">
                  {stat.label}
                </Link>
              </dt>
              <dd className="num font-display text-2xl font-bold leading-none">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="recent-orders" className="mt-12">
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 id="recent-orders" className="display-4">
            {t("recentOrders")}
          </h2>
          {recent.items.length > 0 ? (
            <Link href="/account/orders" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-text underline-offset-4 hover:underline">
              {t("viewAllOrders")}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : null}
        </div>
        {recent.items.length > 0 ? (
          <ul className="space-y-3">
            {recent.items.map((order) => (
              <OrderCard key={order.id} order={order} locale={locale} />
            ))}
          </ul>
        ) : (
          <div className="rounded-md border border-dashed border-border-strong px-6 py-10 text-center">
            <p className="font-medium">{t("noOrdersTitle")}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{t("noOrdersBody")}</p>
            <Link href="/shop" className={buttonStyles({ className: "mt-5" })}>
              {t("startShopping")}
            </Link>
          </div>
        )}
      </section>

      <section aria-labelledby="shortcuts" className="mt-12">
        <h2 id="shortcuts" className="display-4 mb-4">
          {t("shortcuts")}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {shortcuts.map(({ href, icon: Icon, title, body }) => (
            <li key={title}>
              <Link href={href} className="flex h-full gap-3 rounded-md border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-sunken">
                <Icon className="mt-0.5 size-5 shrink-0 text-primary-text" aria-hidden />
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="mt-0.5 block text-sm text-muted">{body}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { OrderCard } from "@/components/account/orders/OrderCard";
import { firstParam, privatePageMetadata } from "@/components/account/seo";
import { AccountPageHeader } from "@/components/account/shell/PageHeader";
import { Pagination, buttonStyles } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/session";
import { listOrdersForUser } from "@/lib/services/orders";

type PageProps = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const PAGE_SIZE = 8;

export async function generateMetadata({ params }: Pick<PageProps, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account.orders" });
  return privatePageMetadata(t("metaTitle"));
}

export default async function OrdersPage({ params, searchParams }: PageProps) {
  const { locale: rawLocale } = await params;
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;
  const user = await requireUser(locale, "/account/orders");
  const page = Math.max(1, Number.parseInt(firstParam((await searchParams).page) ?? "1", 10) || 1);
  const t = await getTranslations("account.orders");
  const result = await listOrdersForUser(user.id, { page, pageSize: PAGE_SIZE });

  return (
    <>
      <AccountPageHeader title={t("title")} description={t("subtitle")} />

      {result.items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border-strong px-6 py-14 text-center">
          <p className="display-4">{t("emptyTitle")}</p>
          <p className="mx-auto mt-2 max-w-sm text-muted">{t("emptyBody")}</p>
          <Link href="/shop" className={buttonStyles({ className: "mt-6" })}>
            {t("startShopping")}
          </Link>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted" aria-live="polite">
            {t("count", { count: result.total })}
          </p>
          <ul className="space-y-3">
            {result.items.map((order) => (
              <OrderCard key={order.id} order={order} locale={locale} />
            ))}
          </ul>
          <Pagination className="mt-8" page={result.page} pageCount={result.pageCount} linkAs={Link} buildHref={(p) => (p === 1 ? "/account/orders" : `/account/orders?page=${p}`)} />
        </>
      )}
    </>
  );
}

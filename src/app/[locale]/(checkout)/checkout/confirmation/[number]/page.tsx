import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { CreditCard, Mail, MapPin, Search, Truck, UserPlus } from "lucide-react";
import { OrderStatusBadge } from "@/components/account/orders/OrderStatusBadge";
import { OrderTimeline } from "@/components/account/orders/OrderTimeline";
import { firstParam, privatePageMetadata } from "@/components/account/seo";
import { AddressBlock } from "@/components/checkout/order/AddressBlock";
import { OrderItemsList } from "@/components/checkout/order/OrderItemsList";
import { OrderTotals } from "@/components/checkout/order/OrderTotals";
import { orderCurrency } from "@/components/checkout/order/order-format";
import { Alert, Card, CardTitle, buttonStyles } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getSessionUser } from "@/lib/auth/session";
import { localize } from "@/lib/i18n-string";
import { formatMoney } from "@/lib/money";
import { wasPaid } from "@/lib/order-status";
import { getOrderByNumber } from "@/lib/services/orders";
import { getPaymentForOrder } from "@/lib/services/payments";

type PageProps = { params: Promise<{ locale: string; number: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Pick<PageProps, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout.confirmation" });
  return privatePageMetadata(t("metaTitle"));
}

/**
 * Order confirmation. Access is proven by the order's secret `?t=` token (guests) or by being the signed-in owner.
 * Anything else is a plain 404, so order numbers cannot be probed.
 */
export default async function ConfirmationPage({ params, searchParams }: PageProps) {
  const { locale: rawLocale, number: rawNumber } = await params;
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;
  const number = decodeURIComponent(rawNumber);
  const token = firstParam((await searchParams).t)?.trim();

  const user = await getSessionUser();
  let order = token ? await getOrderByNumber(number, { accessToken: token }) : null;
  if (!order && user) order = await getOrderByNumber(number, { userId: user.id });
  if (!order) notFound();

  const [t, format, payment] = await Promise.all([getTranslations("checkout.confirmation"), getFormatter(), getPaymentForOrder(order.id)]);
  const currency = orderCurrency(order);
  const paid = wasPaid(order.paymentStatus);
  const isOwner = Boolean(user && order.userId === user.id);
  const shippingMethod = order.shippingMethod;
  const base = new Date(order.createdAt);
  const addDays = (days: number) => new Date(base.getTime() + days * 86_400_000);
  const trackHref = isOwner ? `/account/orders/${order.number}` : "/track-order";

  return (
    <div className="container-page max-w-5xl py-10 lg:py-14">
      <header className="reg-marks mb-10 border border-border-strong bg-surface p-6 sm:p-8">
        <p className="tag-mono mb-5 flex items-center justify-between gap-4 border-b border-dashed border-border-strong pb-3 text-muted">
          <span>{t("certificate")}</span>
          <span className="part-no text-foreground">{order.number}</span>
        </p>
        {paid ? (
          <div className="flex flex-col-reverse items-start gap-5 sm:flex-row sm:justify-between">
            <div>
              <h1 className="display-2">{t("thanksTitle")}</h1>
              <p className="mt-2 max-w-prose text-lg text-muted">{t("thanksBody", { number: order.number })}</p>
            </div>
            <p className="stamp-in font-display -rotate-6 select-none border-[3px] border-double border-success px-4 py-1.5 text-center text-xl font-bold uppercase leading-tight tracking-[0.12em] text-success sm:text-2xl">
              {t("stamp")}
              <span className="mono mt-0.5 block text-[0.6875rem] font-medium tracking-[0.18em]">{format.dateTime(base, { dateStyle: "medium" })}</span>
            </p>
          </div>
        ) : (
          <div>
            <h1 className="display-2">{t("notPaidTitle", { number: order.number })}</h1>
            <Alert tone="warning" className="mt-4 max-w-prose">
              {order.status === "cancelled" ? t("cancelledBody") : t("notPaidBody")}
            </Alert>
            {order.status === "pending_payment" ? (
              <Link href="/checkout" className={buttonStyles({ className: "mt-4" })}>
                {t("retryPayment")}
              </Link>
            ) : null}
          </div>
        )}

        <dl className="mt-8 grid gap-x-8 gap-y-4 border-t border-border-strong pt-5 sm:grid-cols-4">
          <div>
            <dt className="tag-mono text-muted">{t("orderNumber")}</dt>
            <dd className="part-no mt-1 select-all text-lg">{order.number}</dd>
          </div>
          <div>
            <dt className="tag-mono text-muted">{t("date")}</dt>
            <dd className="mono mt-1 text-[0.9375rem]">{format.dateTime(base, { dateStyle: "medium", timeStyle: "short" })}</dd>
          </div>
          <div>
            <dt className="tag-mono text-muted">{t("status")}</dt>
            <dd className="mt-1">
              <OrderStatusBadge status={order.status} />
            </dd>
          </div>
          <div>
            <dt className="tag-mono text-muted">{t("total")}</dt>
            <dd className="mono mt-1 text-lg font-bold">{formatMoney(order.total, locale, currency)}</dd>
          </div>
        </dl>
      </header>

      {paid ? (
        <div className="mb-10 grid gap-3 sm:grid-cols-3">
          <div className="flex gap-3 border border-border-strong bg-surface p-4">
            <Mail className="mt-0.5 size-5 shrink-0 text-primary-text" aria-hidden />
            <div>
              <p className="font-medium">{t("emailTitle")}</p>
              <p className="mt-0.5 text-sm text-muted">{t("emailBody", { email: order.email })}</p>
            </div>
          </div>
          <div className="flex gap-3 border border-border-strong bg-surface p-4">
            <Truck className="mt-0.5 size-5 shrink-0 text-primary-text" aria-hidden />
            <div>
              <p className="font-medium">{t("deliveryTitle")}</p>
              <p className="mt-0.5 text-sm text-muted">
                {t("deliveryBody", {
                  from: format.dateTime(addDays(shippingMethod.estimatedDaysMin), { dateStyle: "medium" }),
                  to: format.dateTime(addDays(shippingMethod.estimatedDaysMax), { dateStyle: "medium" }),
                })}
              </p>
            </div>
          </div>
          <div className="flex gap-3 border border-border-strong bg-surface p-4">
            <Search className="mt-0.5 size-5 shrink-0 text-primary-text" aria-hidden />
            <div>
              <p className="font-medium">{t("trackTitle")}</p>
              <p className="mt-0.5 text-sm text-muted">{isOwner ? t("trackBodyAccount") : t("trackBodyGuest")}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-8">
          <Card as="section" aria-labelledby="conf-items">
            <CardTitle id="conf-items" className="mb-5">
              {t("items")}
            </CardTitle>
            <OrderItemsList items={order.items} locale={locale} currency={currency} />
          </Card>
          <Card as="section" aria-labelledby="conf-progress">
            <h2 id="conf-progress" className="sr-only">
              {t("progress")}
            </h2>
            <OrderTimeline order={order} />
          </Card>
        </div>

        <aside className="space-y-8">
          <Card as="section" aria-labelledby="conf-summary">
            <CardTitle id="conf-summary" className="mb-5">
              {t("summary")}
            </CardTitle>
            <OrderTotals order={order} locale={locale} />
          </Card>
          <Card as="section" aria-labelledby="conf-delivery" className="space-y-4">
            <CardTitle id="conf-delivery" className="flex items-center gap-2">
              <MapPin className="size-5 text-primary-text" aria-hidden />
              {t("shippingTo")}
            </CardTitle>
            <AddressBlock address={order.shippingAddress} locale={locale} />
            <p className="border-t border-border pt-4 text-sm">
              <span className="font-medium">{localize(shippingMethod.name, locale)}</span>
              <span className="num text-muted"> · {shippingMethod.price === 0 ? t("free") : formatMoney(shippingMethod.price, locale, currency)}</span>
            </p>
          </Card>
          <Card as="section" aria-labelledby="conf-payment" className="space-y-2">
            <CardTitle id="conf-payment" className="flex items-center gap-2">
              <CreditCard className="size-5 text-primary-text" aria-hidden />
              {t("payment")}
            </CardTitle>
            <p className="text-sm text-muted">{payment?.method ? t("paidWith", { brand: payment.method.brand.toUpperCase(), last4: payment.method.last4 }) : t("noPaymentMethod")}</p>
          </Card>
        </aside>
      </div>

      {!user ? (
        <section aria-labelledby="conf-account" className="mt-10 flex flex-wrap items-center justify-between gap-4 bg-inverse px-6 py-6 text-inverse-foreground">
          <div className="flex items-start gap-3">
            <UserPlus className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <h2 id="conf-account" className="display-4">
                {t("createAccountTitle")}
              </h2>
              <p className="mt-1 max-w-prose text-sm text-inverse-muted">{t("createAccountBody")}</p>
            </div>
          </div>
          <Link href="/register" className={buttonStyles()}>
            {t("createAccount")}
          </Link>
        </section>
      ) : null}

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href={trackHref} className={buttonStyles({ variant: "outline" })}>
          {isOwner ? t("viewOrder") : t("trackOrder")}
        </Link>
        <Link href="/shop" className={buttonStyles({ variant: "ghost" })}>
          {t("continueShopping")}
        </Link>
      </div>
    </div>
  );
}

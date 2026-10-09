import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { CreditCard, MapPin, Truck } from "lucide-react";
import { OrderActions } from "@/components/account/orders/OrderActions";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/account/orders/OrderStatusBadge";
import { OrderTimeline } from "@/components/account/orders/OrderTimeline";
import { privatePageMetadata } from "@/components/account/seo";
import { AddressBlock } from "@/components/checkout/order/AddressBlock";
import { OrderItemsList } from "@/components/checkout/order/OrderItemsList";
import { OrderTotals } from "@/components/checkout/order/OrderTotals";
import { orderCurrency } from "@/components/checkout/order/order-format";
import { Breadcrumbs, Card, CardTitle } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/session";
import { localize } from "@/lib/i18n-string";
import { formatMoney } from "@/lib/money";
import { wasPaid } from "@/lib/order-status";
import { getOrderByNumber } from "@/lib/services/orders";
import { getPaymentForOrder } from "@/lib/services/payments";

type PageProps = { params: Promise<{ locale: string; number: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, number } = await params;
  const t = await getTranslations({ locale, namespace: "account.order" });
  return privatePageMetadata(t("metaTitle", { number: decodeURIComponent(number) }));
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { locale: rawLocale, number: rawNumber } = await params;
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;
  const number = decodeURIComponent(rawNumber);
  const user = await requireUser(locale, `/account/orders/${number}`);

  const order = await getOrderByNumber(number, { userId: user.id });
  if (!order) notFound();

  const [t, tNav, format, payment] = await Promise.all([
    getTranslations("account.order"),
    getTranslations("account.nav"),
    getFormatter(),
    getPaymentForOrder(order.id),
  ]);
  const currency = orderCurrency(order);
  const paid = wasPaid(order.paymentStatus);
  const canCancel = order.status === "pending_payment" || order.status === "processing";
  const shippingMethod = order.shippingMethod;
  const estimateBase = new Date(order.shippedAt ?? order.createdAt);
  const addDays = (days: number) => new Date(estimateBase.getTime() + days * 86_400_000);
  const showEstimate = order.status === "processing" || order.status === "shipped";

  return (
    <>
      <Breadcrumbs
        linkAs={Link}
        className="mb-6"
        items={[{ label: tNav("overview"), href: "/account" }, { label: tNav("orders"), href: "/account/orders" }, { label: order.number }]}
      />

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="display-3 num">{t("title", { number: order.number })}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
            <span className="num text-sm text-muted">{t("placedOn", { date: format.dateTime(new Date(order.createdAt), { dateStyle: "long", timeStyle: "short" }) })}</span>
          </div>
        </div>
        <OrderActions number={order.number} canCancel={canCancel} isPaid={paid} />
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-8">
          <Card as="section" aria-labelledby="order-items">
            <CardTitle id="order-items" className="mb-5">
              {t("items")}
            </CardTitle>
            <OrderItemsList items={order.items} locale={locale} currency={currency} />
          </Card>

          <Card as="section" aria-labelledby="order-timeline">
            <h2 id="order-timeline" className="sr-only">
              {t("timelineHeading")}
            </h2>
            <OrderTimeline order={order} />
          </Card>
        </div>

        <aside className="space-y-8">
          <Card as="section" aria-labelledby="order-summary">
            <CardTitle id="order-summary" className="mb-5">
              {t("summary")}
            </CardTitle>
            <OrderTotals order={order} locale={locale} />
          </Card>

          <Card as="section" aria-labelledby="order-delivery" className="space-y-5">
            <CardTitle id="order-delivery" className="flex items-center gap-2">
              <Truck className="size-5 text-primary-text" aria-hidden />
              {t("delivery")}
            </CardTitle>
            <div>
              <p className="font-medium">{localize(shippingMethod.name, locale)}</p>
              <p className="num text-sm text-muted">
                {shippingMethod.price === 0 ? t("freeShipping") : formatMoney(shippingMethod.price, locale, currency)}
                {" · "}
                {t("businessDays", { min: shippingMethod.estimatedDaysMin, max: shippingMethod.estimatedDaysMax })}
              </p>
              {showEstimate ? (
                <p className="mt-1 text-sm text-muted">
                  {t("estimatedDelivery", {
                    from: format.dateTime(addDays(shippingMethod.estimatedDaysMin), { dateStyle: "medium" }),
                    to: format.dateTime(addDays(shippingMethod.estimatedDaysMax), { dateStyle: "medium" }),
                  })}
                </p>
              ) : null}
            </div>

            {order.trackingNumber ? (
              <dl className="space-y-1.5 rounded-sm bg-surface-sunken p-3.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">{t("carrier")}</dt>
                  <dd className="font-medium">{order.carrier ?? "-"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">{t("trackingNumber")}</dt>
                  <dd className="num select-all font-medium">{order.trackingNumber}</dd>
                </div>
                {order.shippedAt ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">{t("shippedOn")}</dt>
                    <dd className="num">{format.dateTime(new Date(order.shippedAt), { dateStyle: "medium" })}</dd>
                  </div>
                ) : null}
                {order.deliveredAt ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">{t("deliveredOn")}</dt>
                    <dd className="num">{format.dateTime(new Date(order.deliveredAt), { dateStyle: "medium" })}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}

            <div className="border-t border-border pt-5">
              <h3 className="label-caps mb-2 flex items-center gap-2 text-muted">
                <MapPin className="size-4" aria-hidden />
                {t("shippingAddress")}
              </h3>
              <AddressBlock address={order.shippingAddress} locale={locale} />
            </div>
          </Card>

          <Card as="section" aria-labelledby="order-payment" className="space-y-4">
            <CardTitle id="order-payment" className="flex items-center gap-2">
              <CreditCard className="size-5 text-primary-text" aria-hidden />
              {t("payment")}
            </CardTitle>
            {payment?.method ? (
              <p className="text-sm">
                {t("paidWith", { brand: payment.method.brand.toUpperCase(), last4: payment.method.last4 })}
                <span className="num ml-2 text-muted">
                  {String(payment.method.expMonth).padStart(2, "0")}/{String(payment.method.expYear).slice(-2)}
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted">{t("noPaymentMethod")}</p>
            )}
            <div>
              <h3 className="label-caps mb-2 text-muted">{t("billingAddress")}</h3>
              <AddressBlock address={order.billingAddress} locale={locale} />
            </div>
            {order.customerNote ? (
              <div className="border-t border-border pt-4">
                <h3 className="label-caps mb-1 text-muted">{t("yourNote")}</h3>
                <p className="text-sm">{order.customerNote}</p>
              </div>
            ) : null}
          </Card>
        </aside>
      </div>
    </>
  );
}

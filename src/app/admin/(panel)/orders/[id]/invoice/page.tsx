import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { guard } from "@/components/admin/lib/guard";
import { PrintButton } from "@/components/admin/orders/PrintButton";
import { Logo } from "@/components/brand/Logo";
import { localize } from "@/lib/i18n-string";
import { formatMinor, formatMoney } from "@/lib/money";
import { adminGetOrder } from "@/lib/services/orders";
import { getSettings } from "@/lib/services/settings";
import type { AddressInput } from "@/lib/types/domain";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await adminGetOrder(id);
  return { title: data ? `Invoice ${data.order.number}` : "Invoice" };
}

function Block({ a }: { a: AddressInput }) {
  return (
    <address className="text-sm not-italic leading-relaxed">
      <span className="font-medium">
        {a.firstName} {a.lastName}
      </span>
      {a.company ? <span className="block">{a.company}</span> : null}
      <span className="block">{a.line1}</span>
      {a.line2 ? <span className="block">{a.line2}</span> : null}
      <span className="block">
        {a.postalCode} {a.city}
        {a.region ? `, ${a.region}` : ""}
      </span>
      <span className="block">{a.country}</span>
    </address>
  );
}

/** Printable invoice: the admin chrome is hidden by `print:` rules, the sheet itself is always light for paper. */
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await guard("orders.read");
  const { id } = await params;
  const data = await adminGetOrder(id);
  if (!data) notFound();
  const { order, payment } = data;
  const [t, locale, format, settings] = await Promise.all([getTranslations("admin.orders.invoice"), getLocale(), getFormatter(), getSettings()]);
  const money = (cents: number) => formatMoney(cents, locale);
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "long" });

  return (
    <>
      <PageHeader title={t("title")} back={{ href: `/admin/orders/${order.id}`, label: order.number }} actions={<PrintButton />} />
      <article style={{ colorScheme: "light" }} className="mx-auto max-w-3xl rounded-md border border-border bg-surface p-8 text-foreground shadow-sm print:max-w-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-foreground pb-6">
          <div>
            <Logo variant="light" height={44} />
            <p className="mt-3 text-sm leading-relaxed">
              <span className="block font-medium">{settings.store.legalEntity || settings.store.name}</span>
              <span className="block">{settings.store.address.line1}</span>
              <span className="block">
                {settings.store.address.postalCode} {settings.store.address.city}
                {settings.store.address.region ? `, ${settings.store.address.region}` : ""}, {settings.store.address.country}
              </span>
              <span className="block">{settings.store.email}</span>
              {settings.store.taxId ? <span className="block">{t("taxId", { id: settings.store.taxId })}</span> : null}
            </p>
          </div>
          <div className="text-right">
            <h2 className="font-display text-4xl font-bold uppercase leading-none">{t("title")}</h2>
            <p className="num mt-2 text-sm">
              <span className="text-muted">{t("number")}</span> {order.number}
            </p>
            <p className="num text-sm">
              <span className="text-muted">{t("date")}</span> {date(order.createdAt)}
            </p>
            <p className="num text-sm">
              <span className="text-muted">{t("paymentStatus")}</span> {t(`payment.${order.paymentStatus}`)}
            </p>
          </div>
        </header>

        <section className="grid gap-6 py-6 sm:grid-cols-2">
          <div>
            <h3 className="label-caps mb-1.5 text-muted">{t("billTo")}</h3>
            <Block a={order.billingAddress} />
            <p className="mt-1 text-sm">{order.email}</p>
          </div>
          <div>
            <h3 className="label-caps mb-1.5 text-muted">{t("shipTo")}</h3>
            <Block a={order.shippingAddress} />
            <p className="mt-1 text-sm text-muted">{localize(order.shippingMethod.name, locale)}</p>
          </div>
        </section>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-foreground text-left">
              <th className="label-caps py-2">{t("item")}</th>
              <th className="label-caps py-2 text-right">{t("unit")}</th>
              <th className="label-caps py-2 text-right">{t("qty")}</th>
              <th className="label-caps py-2 text-right">{t("amount")}</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.id} className="border-b border-border align-top">
                <td className="py-2.5 pr-3">
                  <span className="block font-medium">{localize(i.name, locale)}</span>
                  <span className="block text-xs text-muted">
                    <span className="part-no">{i.sku}</span> · {localize(i.variantName, locale)}
                  </span>
                </td>
                <td className="num py-2.5 text-right">{money(i.unitPrice)}</td>
                <td className="num py-2.5 text-right">{i.quantity}</td>
                <td className="num py-2.5 text-right">{money(i.unitPrice * i.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="num ml-auto mt-4 w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <dt>{t("subtotal")}</dt>
            <dd>{money(order.subtotal)}</dd>
          </div>
          {order.discount > 0 ? (
            <div className="flex justify-between">
              <dt>
                {t("discount")}
                {order.couponCode ? ` (${order.couponCode})` : ""}
              </dt>
              <dd>-{money(order.discount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt>{t("shipping")}</dt>
            <dd>{money(order.shipping)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{t("tax")}</dt>
            <dd>{money(order.tax)}</dd>
          </div>
          <div className="flex justify-between border-t-2 border-foreground pt-2 font-display text-xl font-bold uppercase">
            <dt>{t("total")}</dt>
            <dd>{money(order.total)}</dd>
          </div>
          {order.refundedTotal > 0 ? (
            <div className="flex justify-between">
              <dt>{t("refunded")}</dt>
              <dd>-{money(order.refundedTotal)}</dd>
            </div>
          ) : null}
          {order.currency !== "USD" ? (
            <div className="flex justify-between text-muted">
              <dt>{t("chargedIn", { currency: order.currency })}</dt>
              <dd>{formatMinor(order.chargedTotal, order.currency, locale)}</dd>
            </div>
          ) : null}
        </dl>

        {payment?.method ? (
          <p className="mt-6 text-sm text-muted">
            {t("paidWith", { brand: payment.method.brand, last4: payment.method.last4 })}
          </p>
        ) : null}
        <footer className="mt-10 border-t border-border pt-4 text-center text-xs text-muted">{t("thanks", { store: settings.store.name })}</footer>
      </article>
      <p className="mt-4 text-center text-sm print:hidden">
        <Link href={`/admin/orders/${order.id}`} className="text-primary-text underline underline-offset-4">
          {t("backToOrder")}
        </Link>
      </p>
    </>
  );
}

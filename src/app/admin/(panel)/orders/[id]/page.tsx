import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Printer } from "lucide-react";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { StatusBadge } from "@/components/admin/common/StatusBadge";
import { guard } from "@/components/admin/lib/guard";
import { OrderActions } from "@/components/admin/orders/OrderActions";
import { OrderNoteForm } from "@/components/admin/orders/OrderNoteForm";
import { buttonStyles } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, TableContainer, TBody, Td, Th, THead, TFoot, Tr } from "@/components/ui/Table";
import { localize } from "@/lib/i18n-string";
import { formatMinor, formatMoney } from "@/lib/money";
import { isRefundable } from "@/lib/order-status";
import { can } from "@/lib/permissions";
import { adminGetOrder } from "@/lib/services/orders";
import type { AddressInput } from "@/lib/types/domain";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await adminGetOrder(id);
  return { title: data?.order.number ?? "Order" };
}

function Address({ a }: { a: AddressInput }) {
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
      <span className="num block text-muted">{a.phone}</span>
    </address>
  );
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await guard("orders.read");
  const { id } = await params;
  const data = await adminGetOrder(id);
  if (!data) notFound();
  const { order, payment, customer } = data;
  const [t, locale, format] = await Promise.all([getTranslations("admin.orders"), getLocale(), getFormatter()]);
  const money = (cents: number) => formatMoney(cents, locale);
  const dt = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" });
  const shippingRefunded = !!payment?.refunds.some((r) => r.includesShipping);
  const refundable = Math.max(0, order.total - order.refundedTotal);

  return (
    <>
      <PageHeader
        title={order.number}
        back={{ href: "/admin/orders", label: t("title") }}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge kind="order" value={order.status} />
            <StatusBadge kind="payment" value={order.paymentStatus} />
            <span>{dt(order.createdAt)}</span>
          </span>
        }
        actions={
          <>
            <Link href={`/admin/orders/${order.id}/invoice`} className={buttonStyles({ variant: "outline", size: "sm" })}>
              <Printer className="size-4" aria-hidden />
              {t("detail.invoice")}
            </Link>
            <OrderActions
              id={order.id}
              number={order.number}
              status={order.status}
              paymentStatus={order.paymentStatus}
              isPickup={order.shippingMethod.code === "pickup"}
              carrier={order.carrier}
              trackingNumber={order.trackingNumber}
              items={order.items.map((i) => ({ id: i.id, name: localize(i.name, locale), variantName: localize(i.variantName, locale), sku: i.sku, quantity: i.quantity, refundedQuantity: i.refundedQuantity }))}
              shippingRefunded={shippingRefunded}
              shippingCharged={order.shipping}
              refundable={refundable}
              refundableLabel={money(refundable)}
              canWrite={can(user.role, "orders.write")}
              canRefund={can(user.role, "orders.refund") && isRefundable(order.paymentStatus)}
            />
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <Card padding="none">
            <CardHeader className="mb-0 border-b border-border px-4 py-3">
              <CardTitle>{t("detail.items")}</CardTitle>
            </CardHeader>
            <TableContainer className="rounded-none border-0">
              <Table dense caption={t("detail.items")}>
                <THead>
                  <Tr>
                    <Th>{t("detail.product")}</Th>
                    <Th numeric>{t("detail.unit")}</Th>
                    <Th numeric>{t("detail.qty")}</Th>
                    <Th numeric>{t("detail.discount")}</Th>
                                        <Th numeric>{t("detail.lineTotal")}</Th>
                  </Tr>
                </THead>
                <TBody>
                  {order.items.map((i) => (
                    <Tr key={i.id}>
                      <Td>
                        <Link href={`/admin/products/${i.productId}`} className="block max-w-72 truncate font-medium hover:text-primary-text hover:underline">
                          {localize(i.name, locale)}
                        </Link>
                        <span className="block text-xs text-muted">
                          <span className="part-no">{i.sku}</span> · {localize(i.variantName, locale)}
                        </span>
                        {i.refundedQuantity > 0 ? <span className="block text-xs text-danger">{t("detail.refundedQty", { count: i.refundedQuantity })}</span> : null}
                      </Td>
                      <Td numeric>{money(i.unitPrice)}</Td>
                      <Td numeric>{i.quantity}</Td>
                      <Td numeric className="text-muted">
                        {i.discount ? `-${money(i.discount)}` : "-"}
                      </Td>
                      <Td numeric className="font-medium">
                        {money(i.lineTotal)}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
                <TFoot>
                  <Tr>
                    <Td colSpan={4} className="text-right text-muted">
                      {t("detail.subtotal")}
                    </Td>
                    <Td numeric>{money(order.subtotal)}</Td>
                  </Tr>
                  {order.discount > 0 ? (
                    <Tr>
                      <Td colSpan={4} className="text-right text-muted">
                        {t("detail.discountTotal")}
                        {order.couponCode ? <span className="num ml-1">({order.couponCode})</span> : null}
                      </Td>
                      <Td numeric>-{money(order.discount)}</Td>
                    </Tr>
                  ) : null}
                  <Tr>
                    <Td colSpan={4} className="text-right text-muted">
                      {t("detail.shipping")} ({localize(order.shippingMethod.name, locale)})
                    </Td>
                    <Td numeric>{money(order.shipping)}</Td>
                  </Tr>
                  <Tr>
                    <Td colSpan={4} className="text-right text-muted">
                      {t("detail.tax")}
                    </Td>
                    <Td numeric>{money(order.tax)}</Td>
                  </Tr>
                  <Tr>
                    <Td colSpan={4} className="text-right font-display text-lg font-bold uppercase">
                      {t("detail.total")}
                    </Td>
                    <Td numeric className="font-display text-lg font-bold">
                      {money(order.total)}
                    </Td>
                  </Tr>
                  {order.refundedTotal > 0 ? (
                    <Tr>
                      <Td colSpan={4} className="text-right text-danger">
                        {t("detail.refunded")}
                      </Td>
                      <Td numeric className="text-danger">
                        -{money(order.refundedTotal)}
                      </Td>
                    </Tr>
                  ) : null}
                  {order.currency !== "USD" ? (
                    <Tr>
                      <Td colSpan={4} className="text-right text-muted">
                        {t("detail.charged", { rate: order.fxRate })}
                      </Td>
                      <Td numeric>{formatMinor(order.chargedTotal, order.currency, locale)}</Td>
                    </Tr>
                  ) : null}
                </TFoot>
              </Table>
            </TableContainer>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("detail.timeline")}</CardTitle>
            </CardHeader>
            <ol className="relative space-y-4 border-s border-border ps-5">
              {[...order.events].reverse().map((e) => (
                <li key={e.id} className="relative">
                  <span aria-hidden className="absolute -start-[1.6rem] top-1.5 size-2.5 rounded-full border-2 border-surface bg-border-strong" />
                  <p className="text-sm font-medium">{t(`events.${e.type}`)}{e.status ? ` · ${t(`detail.status_${e.status}`)}` : ""}</p>
                  {e.message ? <p className="text-sm text-muted">{e.message}</p> : null}
                  <p className="num text-xs text-subtle">
                    {dt(e.at)} · {e.actor.email ?? (e.actor.id === "system" ? t("detail.system") : e.actor.id)}
                  </p>
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("detail.notes")}</CardTitle>
            </CardHeader>
            {order.customerNote ? (
              <div className="mb-4 rounded-md bg-info-soft p-3 text-sm">
                <p className="label-caps mb-1 text-info">{t("detail.customerNote")}</p>
                <p className="whitespace-pre-wrap">{order.customerNote}</p>
              </div>
            ) : null}
            {order.internalNotes.length > 0 ? (
              <ul className="mb-4 space-y-3">
                {order.internalNotes.map((n) => (
                  <li key={n.id} className="rounded-md bg-surface-sunken p-3 text-sm">
                    <p className="whitespace-pre-wrap">{n.body}</p>
                    <p className="num mt-1 text-xs text-muted">
                      {n.by} · {dt(n.at)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-4 text-sm text-muted">{t("detail.noNotes")}</p>
            )}
            {can(user.role, "orders.write") ? <OrderNoteForm id={order.id} /> : null}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("detail.customer")}</CardTitle>
            </CardHeader>
            <p className="text-sm font-medium">{customer?.name ?? `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`}</p>
            <a href={`mailto:${order.email}`} className="block break-all text-sm text-primary-text underline underline-offset-4">
              {order.email}
            </a>
            <p className="mt-1 text-xs text-muted">{customer ? <Link href={`/admin/customers/${customer.id}`} className="underline">{t("detail.viewCustomer")}</Link> : t("detail.guest")}</p>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("detail.shippingAddress")}</CardTitle>
            </CardHeader>
            <Address a={order.shippingAddress} />
            <div className="mt-3 border-t border-border pt-3 text-sm">
              <p className="text-muted">{localize(order.shippingMethod.name, locale)}</p>
              {order.trackingNumber ? (
                <p className="num mt-1">
                  {order.carrier} · {order.trackingNumber}
                </p>
              ) : null}
              {order.shippedAt ? <p className="text-xs text-muted">{t("detail.shippedAt", { date: dt(order.shippedAt) })}</p> : null}
              {order.deliveredAt ? <p className="text-xs text-muted">{t("detail.deliveredAt", { date: dt(order.deliveredAt) })}</p> : null}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("detail.billingAddress")}</CardTitle>
            </CardHeader>
            <Address a={order.billingAddress} />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("detail.payment")}</CardTitle>
            </CardHeader>
            {payment ? (
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">{t("detail.provider")}</dt>
                  <dd className="num">{payment.provider}</dd>
                </div>
                {payment.method ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">{t("detail.method")}</dt>
                    <dd className="num capitalize">
                      {payment.method.brand} ····{payment.method.last4}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">{t("detail.reference")}</dt>
                  <dd className="num truncate">{payment.providerRef}</dd>
                </div>
                {payment.failureCode ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">{t("detail.failure")}</dt>
                    <dd className="text-danger">{payment.failureCode}</dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="text-sm text-muted">{t("detail.noPayment")}</p>
            )}
            {payment && payment.refunds.length > 0 ? (
              <div className="mt-3 border-t border-border pt-3">
                <p className="label-caps mb-2 text-muted">{t("detail.refunds")}</p>
                <ul className="space-y-2 text-sm">
                  {payment.refunds.map((r) => (
                    <li key={r.id}>
                      <div className="flex justify-between gap-3">
                        <span className="num font-medium text-danger">-{money(r.amount)}</span>
                        <span className="num text-xs text-muted">{dt(r.at)}</span>
                      </div>
                      <p className="text-xs text-muted">{r.reason}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </>
  );
}

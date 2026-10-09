import { useTranslations } from "next-intl";
import { formatMinor, formatMoney } from "@/lib/money";
import type { Order } from "@/lib/types/domain";
import { cn } from "@/lib/utils";
import { orderCurrency } from "./order-format";

/** Money breakdown of a placed order, in the currency it was charged in. */
export function OrderTotals({ order, locale }: { order: Order; locale: string }) {
  const t = useTranslations("checkout.order");
  const currency = orderCurrency(order);
  const money = (cents: number) => formatMoney(cents, locale, currency);
  const row = "flex items-baseline justify-between gap-4";

  return (
    <dl className="space-y-2.5 text-[0.9375rem]">
      <div className={row}>
        <dt className="text-muted">{t("subtotal")}</dt>
        <dd className="num font-medium">{money(order.subtotal)}</dd>
      </div>
      {order.discount > 0 ? (
        <div className={row}>
          <dt className="text-success">{order.couponCode ? t("discountWithCode", { code: order.couponCode }) : t("discount")}</dt>
          <dd className="num font-medium text-success">-{money(order.discount)}</dd>
        </div>
      ) : null}
      <div className={row}>
        <dt className="text-muted">{t("shipping")}</dt>
        <dd className="num font-medium">{order.shipping === 0 ? t("free") : money(order.shipping)}</dd>
      </div>
      <div className={row}>
        <dt className="text-muted">{t("tax")}</dt>
        <dd className="num font-medium">{money(order.tax)}</dd>
      </div>
      <div className={cn(row, "border-t border-border pt-3")}>
        <dt className="font-display text-lg font-bold uppercase tracking-wide">{t("total")}</dt>
        <dd className="num font-display text-2xl font-bold leading-none">{money(order.total)}</dd>
      </div>
      {order.refundedTotal > 0 ? (
        <div className={row}>
          <dt className="text-warning">{t("refunded")}</dt>
          <dd className="num font-medium text-warning">-{money(order.refundedTotal)}</dd>
        </div>
      ) : null}
      {order.currency !== "USD" ? (
        <p className="pt-1 text-[0.8125rem] text-muted">{t("chargedIn", { amount: formatMinor(order.chargedTotal, order.currency, locale), currency: order.currency })}</p>
      ) : null}
    </dl>
  );
}

import { useFormatter, useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { orderCurrency } from "@/components/checkout/order/order-format";
import { ProductThumb } from "@/components/store/product/ProductThumb";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/i18n-string";
import { formatMoney } from "@/lib/money";
import type { Order } from "@/lib/types/domain";
import { OrderStatusBadge } from "./OrderStatusBadge";

const MAX_THUMBS = 4;

/** One row of the order history: number, date, status, a strip of product images and the total. The whole card is one link. */
export function OrderCard({ order, locale }: { order: Order; locale: string }) {
  const t = useTranslations("account.orders");
  const format = useFormatter();
  const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const visible = order.items.slice(0, MAX_THUMBS);
  const hidden = order.items.length - visible.length;

  return (
    <li>
      <Link
        href={`/account/orders/${order.number}`}
        className="group block rounded-md border border-border bg-surface p-4 transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-md sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div>
            <p className="num font-display text-xl font-bold uppercase tracking-wide">{order.number}</p>
            <p className="num text-sm text-muted">{t("placedOn", { date: format.dateTime(new Date(order.createdAt), { dateStyle: "medium" }) })}</p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            {visible.map((item) => (
              <ProductThumb key={item.id} src={item.image} alt={localize(item.name, locale)} className="size-14 sm:size-16" sizes="64px" />
            ))}
            {hidden > 0 ? <span className="num flex size-14 shrink-0 items-center justify-center rounded-sm bg-surface-sunken text-sm font-medium text-muted sm:size-16">+{hidden}</span> : null}
          </div>
          <div className="flex shrink-0 items-center gap-3 text-right">
            <div>
              <p className="num font-display text-xl font-bold leading-none">{formatMoney(order.total, locale, orderCurrency(order))}</p>
              <p className="mt-1 text-sm text-muted">{t("items", { count: units })}</p>
            </div>
            <ChevronRight className="size-5 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
          </div>
        </div>
      </Link>
    </li>
  );
}

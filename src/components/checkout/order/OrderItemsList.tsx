import { useTranslations } from "next-intl";
import { PartNo } from "@/components/shared/PartPlate";
import { ProductThumb } from "@/components/store/product/ProductThumb";
import { localize } from "@/lib/i18n-string";
import { formatMoney, type CurrencyContext } from "@/lib/money";
import type { OrderItem } from "@/lib/types/domain";

/** Read-only line items of a placed order (confirmation page, account order detail). Prices are the frozen USD values shown in the order currency. */
export function OrderItemsList({ items, locale, currency }: { items: OrderItem[]; locale: string; currency: CurrencyContext }) {
  const t = useTranslations("checkout.order");
  const tp = useTranslations("ui.plate");
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
          <ProductThumb src={item.image} alt="" className="size-16 sm:size-20" sizes="80px" />
          <div className="min-w-0 flex-1">
            <p className="font-medium leading-snug text-foreground">{localize(item.name, locale)}</p>
            <p className="mt-0.5 text-sm text-muted">
              {item.brandName}
              {item.variantName.en || item.variantName.tr ? ` · ${localize(item.variantName, locale)}` : ""}
            </p>
            <p className="mt-1 flex items-center gap-2 text-[0.8125rem]">
              <span className="tag-mono text-subtle">{tp("sku")}</span>
              <PartNo className="text-foreground">{item.sku}</PartNo>
            </p>
            <p className="mono mt-1 text-[0.8125rem] text-muted">
              {t("lineQuantity", { quantity: item.quantity, price: formatMoney(item.unitPrice, locale, currency) })}
              {item.refundedQuantity > 0 ? <span className="ml-2 font-medium text-warning">{t("refundedQuantity", { count: item.refundedQuantity })}</span> : null}
            </p>
          </div>
          <p className="mono shrink-0 text-right font-semibold text-foreground">{formatMoney(item.lineTotal, locale, currency)}</p>
        </li>
      ))}
    </ul>
  );
}

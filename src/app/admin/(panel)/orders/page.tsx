import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Download } from "lucide-react";
import { DateFilter, FilterBar, SearchFilter, SelectFilter } from "@/components/admin/common/FilterBar";
import { ListFooter } from "@/components/admin/common/ListFooter";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { StatusBadge } from "@/components/admin/common/StatusBadge";
import { guard } from "@/components/admin/lib/guard";
import { dayEndIso, dayStartIso, enumParam, hrefWith, intParam, param, type SearchParams } from "@/components/admin/lib/params";
import { buttonStyles } from "@/components/ui/Button";
import { Table, TableContainer, TableEmpty, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/lib/order-status";
import { adminListOrders } from "@/lib/services/orders";
import type { OrderFilter } from "@/lib/services/contracts";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.orders");
  return { title: t("title") };
}

const BASE = "/admin/orders";
const SORTS = ["created_desc", "created_asc", "total_desc", "total_asc"] as const;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await guard("orders.read");
  const sp = await searchParams;
  const [t, ts, locale, format] = await Promise.all([getTranslations("admin.orders"), getTranslations("admin.status"), getLocale(), getFormatter()]);

  const q = param(sp, "q");
  const status = enumParam(sp, "status", ["all", ...ORDER_STATUSES] as const, "all");
  const paymentStatus = enumParam(sp, "payment", ["all", ...PAYMENT_STATUSES] as const, "all");
  const from = param(sp, "from");
  const to = param(sp, "to");
  const sort = enumParam(sp, "sort", SORTS, "created_desc");
  const page = intParam(sp, "page", 1);

  const filter: OrderFilter = {
    page,
    pageSize: 25,
    sort,
    status,
    paymentStatus,
    ...(q ? { q } : {}),
    ...(dayStartIso(from) ? { from: dayStartIso(from) } : {}),
    ...(dayEndIso(to) ? { to: dayEndIso(to) } : {}),
  };
  const result = await adminListOrders(filter);

  const exportQs = new URLSearchParams();
  if (q) exportQs.set("q", q);
  if (status !== "all") exportQs.set("status", status);
  if (paymentStatus !== "all") exportQs.set("paymentStatus", paymentStatus);
  if (dayStartIso(from)) exportQs.set("from", dayStartIso(from)!);
  if (dayEndIso(to)) exportQs.set("to", dayEndIso(to)!);

  const sortLink = (asc: (typeof SORTS)[number], desc: (typeof SORTS)[number]) => hrefWith(BASE, sp, { sort: sort === desc ? asc : desc, page: null });

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle", { count: result.total })}
        actions={
          <a href={`/api/admin/export/orders${exportQs.size ? `?${exportQs}` : ""}`} download className={buttonStyles({ variant: "outline", size: "sm" })}>
            <Download className="size-4" aria-hidden />
            {t("exportCsv")}
          </a>
        }
      />
      <FilterBar action={BASE} hidden={{ sort: sort === "created_desc" ? undefined : sort }}>
        <SearchFilter value={q} placeholder={t("searchPlaceholder")} />
        <SelectFilter name="status" label={t("filters.status")} value={status === "all" ? "" : status} allLabel={t("filters.allStatuses")} options={ORDER_STATUSES.map((s) => ({ value: s, label: ts(`order.${s}`) }))} />
        <SelectFilter name="payment" label={t("filters.payment")} value={paymentStatus === "all" ? "" : paymentStatus} allLabel={t("filters.allPayments")} options={PAYMENT_STATUSES.map((s) => ({ value: s, label: ts(`payment.${s}`) }))} />
        <DateFilter name="from" label={t("filters.from")} value={from} />
        <DateFilter name="to" label={t("filters.to")} value={to} />
      </FilterBar>

      <TableContainer>
        <Table caption={t("title")} dense>
          <THead>
            <Tr>
              <Th>{t("cols.order")}</Th>
              <Th className="hidden sm:table-cell" sort={sort === "created_desc" ? "desc" : sort === "created_asc" ? "asc" : "none"} href={sortLink("created_asc", "created_desc")} linkAs={Link}>
                {t("cols.date")}
              </Th>
              <Th className="hidden sm:table-cell">{t("cols.customer")}</Th>
              <Th className="hidden sm:table-cell">{t("cols.status")}</Th>
              <Th className="hidden sm:table-cell">{t("cols.payment")}</Th>
              <Th numeric className="hidden sm:table-cell">
                {t("cols.items")}
              </Th>
              <Th numeric className="max-sm:px-3" sort={sort === "total_desc" ? "desc" : sort === "total_asc" ? "asc" : "none"} href={sortLink("total_asc", "total_desc")} linkAs={Link}>
                {t("cols.total")}
              </Th>
            </Tr>
          </THead>
          <TBody>
            {result.items.length === 0 ? (
              <TableEmpty colSpan={7}>{t("empty")}</TableEmpty>
            ) : (
              result.items.map((o) => (
                <Tr key={o.id} clickable>
                  <Td>
                    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <Link href={`/admin/orders/${o.id}`} className="num whitespace-nowrap font-medium text-primary-text underline-offset-4 [word-break:keep-all] hover:underline">
                        {o.number}
                      </Link>
                      <span className="sm:hidden">
                        <StatusBadge kind="order" value={o.status} />
                      </span>
                    </span>
                    {/* phones: the status badge joins the order number, and customer plus a short date fold under it, so the row reads number + status / total */}
                    <span className="mt-1 block max-w-56 truncate text-xs text-muted sm:hidden">
                      {`${o.shippingAddress.firstName} ${o.shippingAddress.lastName}`} · {format.dateTime(new Date(o.createdAt), { month: "short", day: "numeric" })}
                    </span>
                  </Td>
                  <Td className="hidden whitespace-nowrap text-muted sm:table-cell">{format.dateTime(new Date(o.createdAt), { dateStyle: "medium", timeStyle: "short" })}</Td>
                  <Td className="hidden sm:table-cell">
                    <span className="block max-w-56 truncate">{`${o.shippingAddress.firstName} ${o.shippingAddress.lastName}`}</span>
                    <span className="block max-w-56 truncate text-xs text-muted">{o.email}</span>
                  </Td>
                  <Td className="hidden sm:table-cell">
                    <StatusBadge kind="order" value={o.status} />
                  </Td>
                  <Td className="hidden sm:table-cell">
                    <StatusBadge kind="payment" value={o.paymentStatus} />
                  </Td>
                  <Td numeric className="hidden sm:table-cell">
                    {o.items.reduce((s, i) => s + i.quantity, 0)}
                  </Td>
                  <Td numeric className="max-sm:px-3">
                    {formatMoney(o.total, locale)}
                    {o.currency !== "USD" ? <span className="block text-xs text-muted">{t("chargedIn", { amount: new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", { style: "currency", currency: o.currency }).format(o.chargedTotal / 100) })}</span> : null}
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </TableContainer>
      <ListFooter base={BASE} sp={sp} page={result.page} pageSize={result.pageSize} total={result.total} pageCount={result.pageCount} />
    </>
  );
}

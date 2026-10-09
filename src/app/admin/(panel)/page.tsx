import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle } from "lucide-react";
import { DashboardCharts } from "@/components/admin/dashboard/DashboardCharts";
import { EmptyState } from "@/components/admin/common/EmptyState";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { LedgerStrip, WorkQueue, type QueueItem } from "@/components/admin/common/Ledger";
import { StatusBadge, statusBarClass } from "@/components/admin/common/StatusBadge";
import { guard } from "@/components/admin/lib/guard";
import { enumParam, hrefWith, type SearchParams } from "@/components/admin/lib/params";
import { Alert } from "@/components/ui/Alert";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, TableContainer, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { localize } from "@/lib/i18n-string";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/permissions";
import { getDashboardStats } from "@/lib/services/dashboard";
import { ORDER_STATUSES } from "@/lib/order-status";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.dashboard");
  return { title: t("title") };
}

const RANGES = ["7", "30", "90", "365"] as const;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { user } = await guard("dashboard.read");
  const sp = await searchParams;
  const range = enumParam(sp, "days", RANGES, "30");
  const days = Number(range) as 7 | 30 | 90 | 365;

  const [t, locale, format, stats] = await Promise.all([getTranslations("admin.dashboard"), getLocale(), getFormatter(), getDashboardStats({ days })]);
  const money = (cents: number) => formatMoney(cents, locale);
  const denied = sp.denied !== undefined;
  const maxStatus = Math.max(1, ...ORDER_STATUSES.map((s) => stats.orders.byStatus[s]));
  const queue: QueueItem[] = [
    { key: "pay", label: t("queue.awaitingPayment"), count: stats.orders.byStatus.pending_payment, href: "/admin/orders?status=pending_payment", action: t("queue.open") },
    ...(can(user.role, "reviews.moderate") ? [{ key: "reviews", label: t("queue.reviews"), count: stats.pendingReviews, href: "/admin/reviews?status=pending", action: t("queue.moderate") }] : []),
    { key: "stock", label: t("queue.lowStock"), count: stats.lowStock.length, href: "/admin/inventory?status=low_stock", action: t("queue.restock") },
    ...(can(user.role, "customers.read") ? [{ key: "msg", label: t("queue.messages"), count: stats.newMessages, href: "/admin/messages?status=new", action: t("queue.reply") }] : []),
  ];

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle", { name: user.name })}
        actions={
          <nav aria-label={t("range.label")} className="inline-flex overflow-hidden rounded-sm border border-border-strong">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={hrefWith("/admin", {}, { days: r === "30" ? null : r })}
                aria-current={r === range ? "true" : undefined}
                className={cn("label-caps px-3.5 py-2 text-[0.8125rem] transition-colors", r === range ? "bg-secondary text-secondary-foreground" : "bg-surface text-muted hover:text-foreground")}
              >
                {t(`range.d${r}`)}
              </Link>
            ))}
          </nav>
        }
      />

      {denied ? (
        <Alert tone="warning" className="mb-4">
          {t("denied")}
        </Alert>
      ) : null}

      <div className="space-y-3">
        <WorkQueue label={t("queue.label")} items={queue} />
        <LedgerStrip
          label={t("kpis")}
          cells={[
            { label: t("revenue"), value: money(stats.revenue.total), change: stats.revenue.changePct, hint: t("vsPrevious") },
            { label: t("orders"), value: stats.orders.total, change: stats.orders.changePct, hint: t("vsPrevious") },
            { label: t("aov"), value: money(stats.averageOrderValue) },
            { label: t("customers"), value: stats.customers.total, hint: t("newCustomers", { count: stats.customers.new }) },
          ]}
        />
      </div>

      <div className="mt-4">
        <DashboardCharts series={stats.series} />
      </div>

      <div className="mt-4 grid min-w-0 items-start gap-4 xl:grid-cols-3">
        <Card padding="none" className="min-w-0 overflow-hidden rounded-none xl:col-span-2">
          <CardHeader className="mb-0 border-b border-border px-4 py-3">
            <CardTitle>{t("recentOrders")}</CardTitle>
            <Link href="/admin/orders" className="text-sm text-primary-text underline underline-offset-4">
              {t("viewAll")}
            </Link>
          </CardHeader>
          <TableContainer className="max-w-full rounded-none border-0">
            <Table dense caption={t("recentOrders")}>
              <THead>
                <Tr>
                  <Th>{t("cols.order")}</Th>
                  <Th>{t("cols.customer")}</Th>
                  <Th>{t("cols.status")}</Th>
                  <Th numeric>{t("cols.total")}</Th>
                  <Th>{t("cols.date")}</Th>
                </Tr>
              </THead>
              <TBody>
                {stats.recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState title={t("noOrders")} />
                    </td>
                  </tr>
                ) : (
                  stats.recentOrders.map((o) => (
                    <Tr key={o.id}>
                      <Td>
                        <Link href={`/admin/orders/${o.id}`} className="part-no whitespace-nowrap text-primary-text underline-offset-4 hover:underline">
                          {o.number.replace(/-/g, "\u2011")}
                        </Link>
                      </Td>
                      <Td className="max-w-48 truncate text-muted">{o.email}</Td>
                      <Td>
                        <StatusBadge kind="order" value={o.status} />
                      </Td>
                      <Td numeric className="mono">{money(o.total)}</Td>
                      <Td className="whitespace-nowrap text-muted">{format.dateTime(new Date(o.createdAt), { dateStyle: "medium" })}</Td>
                    </Tr>
                  ))
                )}
              </TBody>
            </Table>
          </TableContainer>
        </Card>

        <Card className="min-w-0 rounded-none">
          <CardHeader>
            <CardTitle>{t("byStatus")}</CardTitle>
          </CardHeader>
          <ul className="space-y-2.5">
            {ORDER_STATUSES.map((s) => (
              <li key={s}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <StatusBadge kind="order" value={s} />
                  <span className="mono font-semibold">{stats.orders.byStatus[s]}</span>
                </div>
                <div className="h-1.5 bg-surface-sunken" aria-hidden>
                  <div className={cn("h-full", statusBarClass("order", s))} style={{ width: `${(stats.orders.byStatus[s] / maxStatus) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card padding="none" className="min-w-0 overflow-hidden rounded-none xl:col-span-2">
          <CardHeader className="mb-0 border-b border-border px-4 py-3">
            <CardTitle>{t("topProducts")}</CardTitle>
          </CardHeader>
          <TableContainer className="rounded-none border-0">
            <Table dense caption={t("topProducts")}>
              <THead>
                <Tr>
                  <Th>{t("cols.product")}</Th>
                  <Th>{t("cols.sku")}</Th>
                  <Th numeric>{t("cols.units")}</Th>
                  <Th numeric>{t("cols.revenue")}</Th>
                </Tr>
              </THead>
              <TBody>
                {stats.topProducts.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <EmptyState title={t("noSales")} />
                    </td>
                  </tr>
                ) : (
                  stats.topProducts.map((p) => (
                    <Tr key={p.productId}>
                      <Td className="max-w-72 truncate">
                        <Link href={`/admin/products/${p.productId}`} className="hover:underline">
                          {localize(p.name, locale)}
                        </Link>
                      </Td>
                      <Td className="part-no text-muted">{p.sku}</Td>
                      <Td numeric className="mono">{p.unitsSold}</Td>
                      <Td numeric className="mono">{money(p.revenue)}</Td>
                    </Tr>
                  ))
                )}
              </TBody>
            </Table>
          </TableContainer>
        </Card>

        <Card padding="none" className="min-w-0 overflow-hidden rounded-none">
          <CardHeader className="mb-0 border-b border-border px-4 py-3">
            <CardTitle className="inline-flex items-center gap-2">
              <AlertTriangle className="size-4 text-warning" aria-hidden />
              {t("lowStock")}
            </CardTitle>
            <Link href="/admin/inventory?low=1" className="text-sm text-primary-text underline underline-offset-4">
              {t("viewAll")}
            </Link>
          </CardHeader>
          {stats.lowStock.length === 0 ? (
            <EmptyState title={t("noLowStock")} />
          ) : (
            <ul className="divide-y divide-border">
              {[...stats.lowStock]
                .sort((x, y) => x.available - x.threshold - (y.available - y.threshold) || x.available - y.available)
                .slice(0, 5)
                .map((v) => (
                  <li key={v.variantId} className="px-4 py-2.5 text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <Link href={`/admin/products/${v.productId}`} className="min-w-0 truncate font-medium hover:underline">
                        {localize(v.name, locale)}
                      </Link>
                      <span className="part-no shrink-0 text-xs text-muted">{v.sku}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className={cn("mono rounded-xs px-2 py-1 text-xs font-medium", v.available <= 0 ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning")}>
                        {t("availableOf", { available: v.available, threshold: v.threshold })}
                      </span>
                      <Link href={`/admin/inventory?q=${encodeURIComponent(v.sku)}`} className="tag-mono inline-flex min-h-9 items-center px-1.5 text-primary-text underline underline-offset-4 hover:no-underline">
                        {t("queue.restock")}
                      </Link>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

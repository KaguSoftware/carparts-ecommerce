import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { DateFilter, FilterBar, SearchFilter, SelectFilter } from "@/components/admin/common/FilterBar";
import { ListFooter } from "@/components/admin/common/ListFooter";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { guard } from "@/components/admin/lib/guard";
import { dayEndIso, dayStartIso, enumParam, hrefWith, intParam, param, type SearchParams } from "@/components/admin/lib/params";
import { StockTable, type StockRow } from "@/components/admin/inventory/StockTable";
import { Table, TableContainer, TableEmpty, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { localize } from "@/lib/i18n-string";
import { can } from "@/lib/permissions";
import { listMovements, listVariantStock } from "@/lib/services/inventory";
import type { InventoryReason } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.inventory");
  return { title: t("title") };
}

const BASE = "/admin/inventory";
const VIEWS = ["stock", "history"] as const;
const STATUSES = ["all", "in_stock", "low_stock", "out_of_stock"] as const;
const REASONS: InventoryReason[] = ["initial", "purchase", "sale", "adjustment", "return", "reservation", "release", "damage", "correction"];

export default async function InventoryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { user } = await guard("catalog.read");
  const sp = await searchParams;
  const [t, tr, locale, format] = await Promise.all([getTranslations("admin.inventory"), getTranslations("admin.inventory.reasons"), getLocale(), getFormatter()]);
  const view = enumParam(sp, "view", VIEWS, "stock");
  const page = intParam(sp, "page", 1);
  const q = param(sp, "q");

  const tabs = (
    <nav aria-label={t("views")} className="mb-4 flex gap-1 border-b border-border">
      {VIEWS.map((v) => (
        <Link
          key={v}
          href={v === "stock" ? BASE : `${BASE}?view=${v}`}
          aria-current={v === view ? "page" : undefined}
          className={cn("label-caps -mb-px border-b-2 px-4 py-3 text-[0.875rem] transition-colors", v === view ? "border-primary text-foreground" : "border-transparent text-muted hover:text-foreground")}
        >
          {t(`views_${v}`)}
        </Link>
      ))}
    </nav>
  );

  if (view === "history") {
    const reason = enumParam(sp, "reason", ["", ...REASONS] as const, "") as InventoryReason | "";
    const from = param(sp, "from");
    const to = param(sp, "to");
    const variantId = param(sp, "variant");
    const productId = param(sp, "product");
    const result = await listMovements({
      page,
      pageSize: 40,
      ...(reason ? { reason } : {}),
      ...(variantId ? { variantId } : {}),
      ...(productId ? { productId } : {}),
      ...(dayStartIso(from) ? { from: dayStartIso(from) } : {}),
      ...(dayEndIso(to) ? { to: dayEndIso(to) } : {}),
    });
    return (
      <>
        <PageHeader title={t("title")} description={t("historySubtitle")} />
        {tabs}
        <FilterBar action={BASE} hidden={{ view: "history", variant: variantId, product: productId }}>
          <SelectFilter name="reason" label={t("filters.reason")} value={reason} allLabel={t("filters.allReasons")} options={REASONS.map((r) => ({ value: r, label: tr(r) }))} />
          <DateFilter name="from" label={t("filters.from")} value={from} />
          <DateFilter name="to" label={t("filters.to")} value={to} />
        </FilterBar>
        <TableContainer>
          <Table dense caption={t("historyCaption")}>
            <THead>
              <Tr>
                <Th>{t("cols.when")}</Th>
                <Th>{t("cols.sku")}</Th>
                <Th>{t("cols.product")}</Th>
                <Th>{t("cols.reason")}</Th>
                <Th numeric>{t("cols.change")}</Th>
                <Th numeric>{t("cols.onHandAfter")}</Th>
                <Th>{t("cols.by")}</Th>
                <Th>{t("cols.note")}</Th>
              </Tr>
            </THead>
            <TBody>
              {result.items.length === 0 ? (
                <TableEmpty colSpan={8}>{t("emptyHistory")}</TableEmpty>
              ) : (
                result.items.map((m) => (
                  <Tr key={m.id}>
                    <Td className="whitespace-nowrap text-muted">{format.dateTime(new Date(m.createdAt), { dateStyle: "medium", timeStyle: "short" })}</Td>
                    <Td className="num font-medium">{m.sku}</Td>
                    <Td className="max-w-64 truncate">
                      <Link href={`/admin/products/${m.productId}`} className="hover:underline">
                        {localize(m.productName, locale)}
                      </Link>
                    </Td>
                    <Td>{tr(m.reason)}</Td>
                    <Td numeric className={m.delta > 0 ? "text-success" : m.delta < 0 ? "text-danger" : "text-muted"}>
                      {m.delta !== 0 ? `${m.delta > 0 ? "+" : ""}${m.delta}` : m.reservedDelta !== 0 ? t("reservedChange", { value: `${m.reservedDelta > 0 ? "+" : ""}${m.reservedDelta}` }) : "0"}
                    </Td>
                    <Td numeric>{m.onHandAfter}</Td>
                    <Td className="max-w-44 truncate text-muted">{m.actor.email ?? (m.actor.id === "system" ? t("system") : m.actor.id)}</Td>
                    <Td className="max-w-64 truncate text-muted">{[m.reference, m.note].filter(Boolean).join(" · ")}</Td>
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

  const status = enumParam(sp, "status", STATUSES, param(sp, "low") === "1" ? "low_stock" : "all");
  const sort = enumParam(sp, "sort", ["sku", "stock_asc", "stock_desc"] as const, "sku");
  const result = await listVariantStock({ page, pageSize: 25, status, sort, ...(q ? { q } : {}) });
  const rows: StockRow[] = result.items.map((r) => ({
    variantId: r.variantId,
    productId: r.productId,
    sku: r.sku,
    product: localize(r.productName, locale),
    variant: localize(r.variantName, locale),
    brand: r.brandName,
    onHand: r.onHand,
    reserved: r.reserved,
    available: r.available,
    threshold: r.threshold,
    isActive: r.isActive,
    status: r.status,
  }));

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle", { count: result.total })} />
      {tabs}
      <FilterBar action={BASE} hidden={{ sort: sort === "sku" ? undefined : sort }}>
        <SearchFilter value={q} placeholder={t("filters.searchPlaceholder")} />
        <SelectFilter
          name="status"
          label={t("filters.status")}
          value={status === "all" ? "" : status}
          allLabel={t("filters.allStatuses")}
          options={STATUSES.filter((s) => s !== "all").map((s) => ({ value: s, label: t(`filters.${s}`) }))}
        />
      </FilterBar>
      <StockTable
        rows={rows}
        canAdjust={can(user.role, "inventory.write")}
        sortState={sort === "stock_asc" ? "asc" : sort === "stock_desc" ? "desc" : "none"}
        sortHref={hrefWith(BASE, sp, { sort: sort === "stock_asc" ? "stock_desc" : "stock_asc", page: null })}
      />
      <ListFooter base={BASE} sp={sp} page={result.page} pageSize={result.pageSize} total={result.total} pageCount={result.pageCount} />
    </>
  );
}

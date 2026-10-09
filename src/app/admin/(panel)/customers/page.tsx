import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { FilterBar, SearchFilter, SelectFilter } from "@/components/admin/common/FilterBar";
import { ListFooter } from "@/components/admin/common/ListFooter";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { StatusBadge } from "@/components/admin/common/StatusBadge";
import { guard } from "@/components/admin/lib/guard";
import { enumParam, hrefWith, intParam, param, type SearchParams } from "@/components/admin/lib/params";
import { Table, TableContainer, TableEmpty, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { formatMoney } from "@/lib/money";
import { listUsers } from "@/lib/services/users-admin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.customers");
  return { title: t("title") };
}

const BASE = "/admin/customers";
const SORTS = ["created_desc", "name_asc", "spent_desc", "orders_desc"] as const;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await guard("customers.read");
  const sp = await searchParams;
  const [t, locale, format] = await Promise.all([getTranslations("admin.customers"), getLocale(), getFormatter()]);
  const q = param(sp, "q");
  const status = enumParam(sp, "status", ["all", "active", "disabled"] as const, "all");
  const sort = enumParam(sp, "sort", SORTS, "created_desc");
  const page = intParam(sp, "page", 1);
  const result = await listUsers({ page, pageSize: 25, role: "customer", status, sort, ...(q ? { q } : {}) });
  const sortHref = (s: (typeof SORTS)[number]) => hrefWith(BASE, sp, { sort: s === "created_desc" ? null : s, page: null });

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle", { count: result.total })} />
      <FilterBar action={BASE} hidden={{ sort: sort === "created_desc" ? undefined : sort }}>
        <SearchFilter value={q} placeholder={t("searchPlaceholder")} />
        <SelectFilter
          name="status"
          label={t("filters.status")}
          value={status === "all" ? "" : status}
          allLabel={t("filters.all")}
          options={[
            { value: "active", label: t("filters.active") },
            { value: "disabled", label: t("filters.disabled") },
          ]}
        />
      </FilterBar>
      <TableContainer>
        <Table dense caption={t("title")}>
          <THead>
            <Tr>
              <Th sort={sort === "name_asc" ? "asc" : "none"} href={sortHref("name_asc")} linkAs={Link}>
                {t("cols.customer")}
              </Th>
              <Th>{t("cols.status")}</Th>
              <Th numeric sort={sort === "orders_desc" ? "desc" : "none"} href={sortHref("orders_desc")} linkAs={Link}>
                {t("cols.orders")}
              </Th>
              <Th numeric sort={sort === "spent_desc" ? "desc" : "none"} href={sortHref("spent_desc")} linkAs={Link}>
                {t("cols.spent")}
              </Th>
              <Th>{t("cols.lastOrder")}</Th>
              <Th sort={sort === "created_desc" ? "desc" : "none"} href={sortHref("created_desc")} linkAs={Link}>
                {t("cols.joined")}
              </Th>
            </Tr>
          </THead>
          <TBody>
            {result.items.length === 0 ? (
              <TableEmpty colSpan={6}>{t("empty")}</TableEmpty>
            ) : (
              result.items.map((r) => (
                <Tr key={r.user.id}>
                  <Td>
                    <Link href={`/admin/customers/${r.user.id}`} className="block font-medium hover:text-primary-text hover:underline">
                      {r.user.name}
                    </Link>
                    <span className="block text-xs text-muted">{r.user.email}</span>
                  </Td>
                  <Td>
                    <StatusBadge kind="user" value={r.user.disabled ? "disabled" : "active"} />
                  </Td>
                  <Td numeric>{r.orderCount}</Td>
                  <Td numeric>{formatMoney(r.totalSpent, locale)}</Td>
                  <Td className="whitespace-nowrap text-muted">{r.lastOrderAt ? format.dateTime(new Date(r.lastOrderAt), { dateStyle: "medium" }) : "-"}</Td>
                  <Td className="whitespace-nowrap text-muted">{format.dateTime(new Date(r.user.createdAt), { dateStyle: "medium" })}</Td>
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

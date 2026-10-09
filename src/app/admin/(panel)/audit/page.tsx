import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { DateFilter, FilterBar, SearchFilter } from "@/components/admin/common/FilterBar";
import { ListFooter } from "@/components/admin/common/ListFooter";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { guard } from "@/components/admin/lib/guard";
import { dayEndIso, dayStartIso, intParam, param, type SearchParams } from "@/components/admin/lib/params";
import { Badge } from "@/components/ui/Badge";
import { Table, TableContainer, TableEmpty, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { listAudit } from "@/lib/services/audit";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.audit");
  return { title: t("title") };
}

const BASE = "/admin/audit";

const show = (v: unknown): string => (typeof v === "string" ? v : JSON.stringify(v));

export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await guard("audit.read");
  const sp = await searchParams;
  const [t, format] = await Promise.all([getTranslations("admin.audit"), getFormatter()]);
  const q = param(sp, "q");
  const action = param(sp, "action");
  const entityType = param(sp, "entity");
  const from = param(sp, "from");
  const to = param(sp, "to");
  const page = intParam(sp, "page", 1);
  const result = await listAudit({
    page,
    pageSize: 40,
    ...(q ? { q } : {}),
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
    ...(dayStartIso(from) ? { from: dayStartIso(from) } : {}),
    ...(dayEndIso(to) ? { to: dayEndIso(to) } : {}),
  });

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle", { count: result.total })} />
      <FilterBar action={BASE}>
        <SearchFilter value={q} placeholder={t("searchPlaceholder")} />
        <SearchFilter name="action" value={action} label={t("filters.action")} placeholder="order.refund" />
        <SearchFilter name="entity" value={entityType} label={t("filters.entity")} placeholder="product" />
        <DateFilter name="from" label={t("filters.from")} value={from} />
        <DateFilter name="to" label={t("filters.to")} value={to} />
      </FilterBar>
      <TableContainer>
        <Table dense caption={t("title")}>
          <THead>
            <Tr>
              <Th>{t("cols.when")}</Th>
              <Th>{t("cols.actor")}</Th>
              <Th>{t("cols.action")}</Th>
              <Th>{t("cols.entity")}</Th>
              <Th>{t("cols.summary")}</Th>
            </Tr>
          </THead>
          <TBody>
            {result.items.length === 0 ? (
              <TableEmpty colSpan={5}>{t("empty")}</TableEmpty>
            ) : (
              result.items.map((e) => (
                <Tr key={e.id} className="align-top">
                  <Td className="whitespace-nowrap text-muted">{format.dateTime(new Date(e.at), { dateStyle: "medium", timeStyle: "medium" })}</Td>
                  <Td>
                    <span className="block max-w-48 truncate">{e.actor.email ?? (e.actor.id === "system" ? t("system") : e.actor.id)}</span>
                    <span className="label-caps text-subtle">{e.actor.role}</span>
                  </Td>
                  <Td>
                    <Badge tone="outline" className="num normal-case tracking-normal">
                      {e.action}
                    </Badge>
                  </Td>
                  <Td className="num text-xs text-muted">
                    {e.entityType}
                    <span className="block max-w-36 truncate">{e.entityId}</span>
                  </Td>
                  <Td className="max-w-xl">
                    <span className="block">{e.summary}</span>
                    {e.changes && Object.keys(e.changes).length > 0 ? (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-primary-text">{t("changes", { count: Object.keys(e.changes).length })}</summary>
                        <ul className="num mt-1 space-y-0.5 rounded-sm bg-surface-sunken p-2 text-xs">
                          {Object.entries(e.changes).map(([field, diff]) => (
                            <li key={field} className="break-words">
                              <span className="font-medium">{field}</span>: <span className="text-danger">{show(diff.from)}</span> → <span className="text-success">{show(diff.to)}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
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

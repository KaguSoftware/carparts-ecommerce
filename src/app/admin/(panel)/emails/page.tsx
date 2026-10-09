import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { FilterBar, SearchFilter } from "@/components/admin/common/FilterBar";
import { ListFooter } from "@/components/admin/common/ListFooter";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { guard } from "@/components/admin/lib/guard";
import { intParam, param, type SearchParams } from "@/components/admin/lib/params";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Table, TableContainer, TableEmpty, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { listOutbox } from "@/lib/email";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.emails");
  return { title: t("title") };
}

const BASE = "/admin/emails";

export default async function EmailsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await guard("settings.write");
  const sp = await searchParams;
  const [t, format] = await Promise.all([getTranslations("admin.emails"), getFormatter()]);
  const to = param(sp, "to");
  const page = intParam(sp, "page", 1);
  const result = await listOutbox({ page, pageSize: 30, ...(to ? { to } : {}) });
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <Alert tone="info" className="mb-4">
        {t("note")}
      </Alert>
      <FilterBar action={BASE}>
        <SearchFilter name="to" value={to} label={t("filters.to")} placeholder={t("filters.toPlaceholder")} />
      </FilterBar>
      <TableContainer>
        <Table dense caption={t("title")}>
          <THead>
            <Tr>
              <Th>{t("cols.when")}</Th>
              <Th>{t("cols.to")}</Th>
              <Th>{t("cols.subject")}</Th>
              <Th>{t("cols.template")}</Th>
              <Th>{t("cols.language")}</Th>
            </Tr>
          </THead>
          <TBody>
            {result.items.length === 0 ? (
              <TableEmpty colSpan={5}>{t("empty")}</TableEmpty>
            ) : (
              result.items.map((m) => (
                <Tr key={m.id}>
                  <Td className="whitespace-nowrap text-muted">{format.dateTime(new Date(m.at), { dateStyle: "medium", timeStyle: "short" })}</Td>
                  <Td>{m.to}</Td>
                  <Td className="max-w-md">
                    <Link href={`/admin/emails/${m.id}`} className="block truncate font-medium hover:text-primary-text hover:underline">
                      {m.subject}
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone="outline" className="num normal-case tracking-normal">
                      {m.template}
                    </Badge>
                  </Td>
                  <Td className="uppercase text-muted">{m.locale}</Td>
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

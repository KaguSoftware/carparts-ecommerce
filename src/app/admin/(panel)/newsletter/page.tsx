import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Download, Trash2 } from "lucide-react";
import { deleteSubscriberAction } from "@/actions/admin/content";
import { ConfirmActionButton } from "@/components/admin/common/ConfirmActionButton";
import { FilterBar, SearchFilter } from "@/components/admin/common/FilterBar";
import { ListFooter } from "@/components/admin/common/ListFooter";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { guard } from "@/components/admin/lib/guard";
import { intParam, param, type SearchParams } from "@/components/admin/lib/params";
import { Badge } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { Table, TableContainer, TableEmpty, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { listSubscribers } from "@/lib/services/newsletter";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.newsletter");
  return { title: t("title") };
}

const BASE = "/admin/newsletter";

export default async function NewsletterPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await guard("marketing.write");
  const sp = await searchParams;
  const [t, format] = await Promise.all([getTranslations("admin.newsletter"), getFormatter()]);
  const q = param(sp, "q");
  const page = intParam(sp, "page", 1);
  const result = await listSubscribers({ page, pageSize: 30, ...(q ? { q } : {}) });

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle", { count: result.total })}
        actions={
          <a href="/api/admin/export/subscribers" download className={buttonStyles({ variant: "outline", size: "sm" })}>
            <Download className="size-4" aria-hidden />
            {t("export")}
          </a>
        }
      />
      <FilterBar action={BASE}>
        <SearchFilter value={q} placeholder={t("searchPlaceholder")} />
      </FilterBar>
      <TableContainer>
        <Table dense caption={t("title")}>
          <THead>
            <Tr>
              <Th>{t("cols.email")}</Th>
              <Th>{t("cols.language")}</Th>
              <Th>{t("cols.source")}</Th>
              <Th>{t("cols.subscribed")}</Th>
              <Th>{t("cols.status")}</Th>
              <Th className="w-px">
                <span className="sr-only">{t("cols.actions")}</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {result.items.length === 0 ? (
              <TableEmpty colSpan={6}>{t("empty")}</TableEmpty>
            ) : (
              result.items.map((s) => (
                <Tr key={s.id}>
                  <Td className="font-medium">{s.email}</Td>
                  <Td className="uppercase text-muted">{s.locale}</Td>
                  <Td className="text-muted">{s.source}</Td>
                  <Td className="whitespace-nowrap text-muted">{format.dateTime(new Date(s.subscribedAt), { dateStyle: "medium" })}</Td>
                  <Td>
                    <Badge tone={s.unsubscribedAt ? "neutral" : "success"} dot>
                      {s.unsubscribedAt ? t("unsubscribed") : t("subscribed")}
                    </Badge>
                  </Td>
                  <Td>
                    <ConfirmActionButton
                      size="icon-sm"
                      aria-label={t("delete", { email: s.email })}
                      action={deleteSubscriberAction.bind(null, { id: s.id })}
                      title={t("deleteTitle", { email: s.email })}
                      description={t("deleteBody")}
                      confirmLabel={t("deleteConfirm")}
                      success={t("deleted")}
                    >
                      <Trash2 className="size-4" />
                    </ConfirmActionButton>
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

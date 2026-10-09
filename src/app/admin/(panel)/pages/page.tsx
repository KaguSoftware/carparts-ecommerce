import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Plus, Trash2 } from "lucide-react";
import { deletePageAction } from "@/actions/admin/content";
import { ConfirmActionButton } from "@/components/admin/common/ConfirmActionButton";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { guard } from "@/components/admin/lib/guard";
import { Badge } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { Table, TableContainer, TableEmpty, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { isLocalizedComplete, localize } from "@/lib/i18n-string";
import { listPages } from "@/lib/services/cms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.pages");
  return { title: t("title") };
}

export default async function PagesPage() {
  await guard("cms.write");
  const [t, locale, format, pages] = await Promise.all([getTranslations("admin.pages"), getLocale(), getFormatter(), listPages()]);
  const sorted = [...pages].sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Link href="/admin/pages/new" className={buttonStyles({ size: "sm" })}>
            <Plus className="size-4" aria-hidden />
            {t("new")}
          </Link>
        }
      />
      <TableContainer>
        <Table dense caption={t("title")}>
          <THead>
            <Tr>
              <Th>{t("cols.title")}</Th>
              <Th>{t("cols.slug")}</Th>
              <Th>{t("cols.status")}</Th>
              <Th>{t("cols.translation")}</Th>
              <Th>{t("cols.updated")}</Th>
              <Th className="w-px">
                <span className="sr-only">{t("cols.actions")}</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {sorted.length === 0 ? (
              <TableEmpty colSpan={6}>{t("empty")}</TableEmpty>
            ) : (
              sorted.map((p) => (
                <Tr key={p.id}>
                  <Td>
                    <Link href={`/admin/pages/${p.id}`} className="font-medium hover:text-primary-text hover:underline">
                      {localize(p.title, locale)}
                    </Link>
                  </Td>
                  <Td className="num text-muted">/pages/{p.slug}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={p.isPublished ? "success" : "warning"} dot>
                        {p.isPublished ? t("published") : t("draft")}
                      </Badge>
                      {p.showInFooter ? <Badge tone="outline">{t("inFooter")}</Badge> : null}
                    </div>
                  </Td>
                  <Td>
                    {isLocalizedComplete(p.title) && isLocalizedComplete(p.body) ? <Badge tone="success">{t("translated")}</Badge> : <Badge tone="warning">{t("missingTranslation")}</Badge>}
                  </Td>
                  <Td className="whitespace-nowrap text-muted">{format.dateTime(new Date(p.updatedAt), { dateStyle: "medium" })}</Td>
                  <Td>
                    <ConfirmActionButton
                      size="icon-sm"
                      aria-label={t("delete", { title: localize(p.title, locale) })}
                      action={deletePageAction.bind(null, { id: p.id })}
                      title={t("deleteTitle", { title: localize(p.title, locale) })}
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
    </>
  );
}

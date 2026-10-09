import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { FilterBar, SearchFilter, SelectFilter } from "@/components/admin/common/FilterBar";
import { ListFooter } from "@/components/admin/common/ListFooter";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { MessagesInbox, type MessageRow } from "@/components/admin/content/MessagesInbox";
import { guard } from "@/components/admin/lib/guard";
import { enumParam, intParam, param, type SearchParams } from "@/components/admin/lib/params";
import { can } from "@/lib/permissions";
import { listMessages } from "@/lib/services/contact";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.messages");
  return { title: t("title") };
}

const BASE = "/admin/messages";
const STATUSES = ["all", "new", "read", "replied", "archived"] as const;

export default async function MessagesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { user } = await guard("customers.read");
  const sp = await searchParams;
  const t = await getTranslations("admin.messages");
  const q = param(sp, "q");
  const status = enumParam(sp, "status", STATUSES, "all");
  const page = intParam(sp, "page", 1);
  const result = await listMessages({ page, pageSize: 25, status, ...(q ? { q } : {}) });
  const rows: MessageRow[] = result.items.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    phone: m.phone,
    subject: m.subject,
    message: m.message,
    orderNumber: m.orderNumber,
    locale: m.locale,
    status: m.status,
    adminNotes: m.adminNotes,
    createdAt: m.createdAt,
  }));
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle", { count: result.total })} />
      <FilterBar action={BASE}>
        <SearchFilter value={q} placeholder={t("searchPlaceholder")} />
        <SelectFilter name="status" label={t("filters.status")} value={status === "all" ? "" : status} allLabel={t("filters.all")} options={STATUSES.filter((s) => s !== "all").map((s) => ({ value: s, label: t(`filters.${s}`) }))} />
      </FilterBar>
      <MessagesInbox rows={rows} canWrite={can(user.role, "orders.write")} />
      <ListFooter base={BASE} sp={sp} page={result.page} pageSize={result.pageSize} total={result.total} pageCount={result.pageCount} />
    </>
  );
}

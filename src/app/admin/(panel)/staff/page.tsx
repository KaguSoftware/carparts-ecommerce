import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { guard } from "@/components/admin/lib/guard";
import { StaffManager, type StaffRow } from "@/components/admin/staff/StaffManager";
import { Alert } from "@/components/ui/Alert";
import { listUsers } from "@/lib/services/users-admin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.staff");
  return { title: t("title") };
}

export default async function StaffPage() {
  const { user } = await guard("users.manage");
  const [t, result] = await Promise.all([getTranslations("admin.staff"), listUsers({ role: "staff_and_admin", pageSize: 100, sort: "name_asc" })]);
  const rows: StaffRow[] = result.items.map((r) => ({
    id: r.user.id,
    name: r.user.name,
    email: r.user.email,
    role: r.user.role === "admin" ? "admin" : "staff",
    disabled: r.user.disabled,
    lastLoginAt: r.user.lastLoginAt ?? undefined,
    createdAt: r.user.createdAt,
    isSelf: r.user.id === user.id,
  }));
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <Alert tone="info" className="mb-4">
        {t("permissionsNote")}
      </Alert>
      <StaffManager rows={rows} />
    </>
  );
}

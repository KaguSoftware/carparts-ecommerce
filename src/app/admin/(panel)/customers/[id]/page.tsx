import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { StatusBadge } from "@/components/admin/common/StatusBadge";
import { CustomerActions } from "@/components/admin/customers/CustomerActions";
import { guard } from "@/components/admin/lib/guard";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, TableContainer, TableEmpty, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/permissions";
import { getUserDetail } from "@/lib/services/users-admin";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const d = await getUserDetail(id);
  return { title: d?.user.name ?? "Customer" };
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user: me } = await guard("customers.read");
  const { id } = await params;
  const detail = await getUserDetail(id);
  if (!detail) notFound();
  const { user, addresses, orders, totalSpent, reviewsCount } = detail;
  const [t, locale, format] = await Promise.all([getTranslations("admin.customers.detail"), getLocale(), getFormatter()]);
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });

  return (
    <>
      <PageHeader
        title={user.name}
        back={{ href: "/admin/customers", label: t("back") }}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge kind="role" value={user.role} />
            <StatusBadge kind="user" value={user.disabled ? "disabled" : "active"} />
            <span>{user.email}</span>
          </span>
        }
        actions={user.role === "customer" && can(me.role, "users.manage") ? <CustomerActions id={user.id} name={user.name} disabled={user.disabled} /> : null}
      />

      <section aria-label={t("stats")} className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: t("orders"), value: orders.length },
          { label: t("spent"), value: formatMoney(totalSpent, locale) },
          { label: t("reviews"), value: reviewsCount },
          { label: t("joined"), value: date(user.createdAt) },
        ].map((s) => (
          <div key={s.label} className="rounded-md border border-border bg-surface p-4">
            <p className="label-caps text-muted">{s.label}</p>
            <p className="num mt-2 font-display text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card padding="none">
          <CardHeader className="mb-0 border-b border-border px-4 py-3">
            <CardTitle>{t("orderHistory")}</CardTitle>
          </CardHeader>
          <TableContainer className="rounded-none border-0">
            <Table dense caption={t("orderHistory")}>
              <THead>
                <Tr>
                  <Th>{t("cols.order")}</Th>
                  <Th>{t("cols.date")}</Th>
                  <Th>{t("cols.status")}</Th>
                  <Th numeric>{t("cols.total")}</Th>
                </Tr>
              </THead>
              <TBody>
                {orders.length === 0 ? (
                  <TableEmpty colSpan={4}>{t("noOrders")}</TableEmpty>
                ) : (
                  orders.map((o) => (
                    <Tr key={o.id}>
                      <Td>
                        <Link href={`/admin/orders/${o.id}`} className="num font-medium text-primary-text hover:underline">
                          {o.number}
                        </Link>
                      </Td>
                      <Td className="text-muted">{date(o.createdAt)}</Td>
                      <Td>
                        <StatusBadge kind="order" value={o.status} />
                      </Td>
                      <Td numeric>{formatMoney(o.total, locale)}</Td>
                    </Tr>
                  ))
                )}
              </TBody>
            </Table>
          </TableContainer>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("profile")}</CardTitle>
            </CardHeader>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("phone")}</dt>
                <dd className="num">{user.phone || "-"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("language")}</dt>
                <dd>{user.locale.toUpperCase()}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("marketing")}</dt>
                <dd>{user.marketingOptIn ? t("yes") : t("no")}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("verified")}</dt>
                <dd>{user.emailVerified ? t("yes") : t("no")}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("lastLogin")}</dt>
                <dd>{user.lastLoginAt ? date(user.lastLoginAt) : "-"}</dd>
              </div>
            </dl>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("addresses")}</CardTitle>
            </CardHeader>
            {addresses.length === 0 ? (
              <p className="text-sm text-muted">{t("noAddresses")}</p>
            ) : (
              <ul className="space-y-3">
                {addresses.map((a) => (
                  <li key={a.id}>
                    <address className="text-sm not-italic leading-relaxed">
                      <span className="font-medium">
                        {a.firstName} {a.lastName}
                      </span>
                      <span className="block">{a.line1}</span>
                      <span className="block">
                        {a.postalCode} {a.city}, {a.country}
                      </span>
                    </address>
                    {a.isDefaultShipping ? <span className="text-xs text-muted">{t("defaultShipping")}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

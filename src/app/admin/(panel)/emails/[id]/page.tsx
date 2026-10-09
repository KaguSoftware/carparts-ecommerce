import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { guard } from "@/components/admin/lib/guard";
import { getOutboxEmail } from "@/lib/email";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const mail = await getOutboxEmail(id);
  return { title: mail?.subject ?? "Email" };
}

export default async function EmailDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await guard("settings.write");
  const { id } = await params;
  const mail = await getOutboxEmail(id);
  if (!mail) notFound();
  const [t, format] = await Promise.all([getTranslations("admin.emails"), getFormatter()]);
  return (
    <>
      <PageHeader title={mail.subject} back={{ href: "/admin/emails", label: t("title") }} description={`${mail.to} · ${format.dateTime(new Date(mail.at), { dateStyle: "medium", timeStyle: "short" })}`} />
      <div className="rounded-md border border-border bg-surface p-2">
        {/* Rendered inside a fully sandboxed frame: the stored HTML can never run scripts or reach the panel. */}
        <iframe title={mail.subject} sandbox="" srcDoc={mail.html} className="h-[70dvh] w-full rounded-sm bg-white" />
      </div>
      <details className="mt-4 rounded-md border border-border bg-surface p-4">
        <summary className="cursor-pointer text-sm font-medium">{t("plainText")}</summary>
        <pre className="mt-3 whitespace-pre-wrap break-words text-sm text-muted">{mail.text}</pre>
      </details>
    </>
  );
}

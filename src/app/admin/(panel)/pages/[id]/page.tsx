import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ExternalLink } from "lucide-react";
import { PageForm } from "@/components/admin/content/PageForm";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { guard } from "@/components/admin/lib/guard";
import { localize } from "@/lib/i18n-string";
import { getPageById } from "@/lib/services/cms";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const page = await getPageById(id);
  return { title: page ? localize(page.title, "en") : "Page" };
}

export default async function EditPagePage({ params }: { params: Promise<{ id: string }> }) {
  await guard("cms.write");
  const { id } = await params;
  const page = await getPageById(id);
  if (!page) notFound();
  const [t, locale] = await Promise.all([getTranslations("admin.pages"), getLocale()]);
  return (
    <>
      <PageHeader
        title={localize(page.title, locale)}
        back={{ href: "/admin/pages", label: t("title") }}
        actions={
          page.isPublished ? (
            <a href={`/${locale}/pages/${page.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary-text underline underline-offset-4">
              {t("viewLive")}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null
        }
      />
      <PageForm
        id={id}
        initial={{
          slug: page.slug,
          title: page.title,
          body: page.body,
          isPublished: page.isPublished,
          showInFooter: page.showInFooter,
          sortOrder: page.sortOrder,
          seoDescription: page.seoDescription ?? { en: "", tr: "" },
        }}
      />
    </>
  );
}

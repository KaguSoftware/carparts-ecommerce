import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/ui";
import { TrackOrder } from "@/components/store/pages/TrackOrder";
import { getStoreContext } from "@/components/store/shared/context";
import { pageMetadata } from "@/components/store/shared/seo";
import { Link } from "@/i18n/navigation";
import { isLocale } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "store.track" });
  return pageMetadata({ locale, path: "/track-order", title: t("metaTitle"), description: t("metaDescription") });
}

export default async function TrackOrderPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("store.track");
  const ctx = await getStoreContext(locale);
  return (
    <div className="container-page py-8 md:py-12">
      <Breadcrumbs linkAs={Link} items={[{ label: t("home"), href: "/" }, { label: t("title") }]} />
      <div className="mb-10 mt-6 max-w-2xl">
        <h1 className="display-2">{t("title")}</h1>
        <p className="mt-3 text-[1.0625rem] text-muted">{t("intro")}</p>
      </div>
      <TrackOrder defaultEmail={ctx.user?.email ?? ""} />
    </div>
  );
}

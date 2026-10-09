import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BannersManager, type BannerRow } from "@/components/admin/content/BannersManager";
import { PageHeader } from "@/components/admin/common/PageHeader";
import { guard } from "@/components/admin/lib/guard";
import { bannerIsLive, listBanners } from "@/lib/services/banners";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.banners");
  return { title: t("title") };
}

export default async function BannersPage() {
  await guard("marketing.write");
  const [t, banners] = await Promise.all([getTranslations("admin.banners"), listBanners()]);
  const now = new Date();
  const rows: BannerRow[] = banners.map((b) => ({
    id: b.id,
    placement: b.placement,
    title: b.title,
    subtitle: b.subtitle,
    ctaLabel: b.ctaLabel,
    ctaHref: b.ctaHref,
    image: b.image,
    tone: b.tone,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    isActive: b.isActive,
    sortOrder: b.sortOrder,
    live: bannerIsLive(b, now),
  }));
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <BannersManager rows={rows} />
    </>
  );
}

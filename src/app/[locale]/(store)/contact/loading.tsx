import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui";

export default async function Loading() {
  const t = await getTranslations("ui.spinner");
  return (
    <div className="container-page py-12" role="status" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="mb-10 h-12 w-64" />
      <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr]">
        <Skeleton className="h-[28rem]" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

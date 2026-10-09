import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui";

export default async function Loading() {
  const t = await getTranslations("ui.spinner");
  return (
    <div className="container-page py-10" role="status" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="mb-8 h-12 w-56" />
      <div className="grid gap-10 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="size-28 shrink-0" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-10 w-32" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

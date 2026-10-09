import { getTranslations } from "next-intl/server";
import { ProductCardSkeleton, Skeleton } from "@/components/ui";

/** Loading state shared by every catalogue route (loading.tsx). */
export async function ListingSkeleton({ hero = true }: { hero?: boolean }) {
  const t = await getTranslations("ui.spinner");
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{t("loading")}</span>
      {hero ? (
        <div className="bg-inverse">
          <div className="container-page space-y-4 py-14">
            <Skeleton className="h-10 w-2/3 max-w-md bg-inverse-surface" />
            <Skeleton className="h-4 w-full max-w-lg bg-inverse-surface" />
          </div>
        </div>
      ) : null}
      <div className="container-page grid min-w-0 grid-cols-[minmax(0,1fr)] gap-10 py-10 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
        <div className="hidden space-y-6 lg:block">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3">
          {Array.from({ length: 9 }, (_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

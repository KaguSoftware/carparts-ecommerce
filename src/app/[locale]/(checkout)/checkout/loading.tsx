import { Skeleton } from "@/components/ui";

export default function CheckoutLoading() {
  return (
    <div className="container-page py-8 lg:py-12" aria-busy="true">
      <Skeleton className="mb-8 h-14 w-72 max-w-full" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_25rem] xl:gap-14">
        <div className="space-y-10">
          <Skeleton className="h-40" />
          <Skeleton className="h-96" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="hidden h-[28rem] lg:block" />
      </div>
    </div>
  );
}

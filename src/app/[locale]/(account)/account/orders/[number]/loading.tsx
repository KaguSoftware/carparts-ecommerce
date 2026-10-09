import { Skeleton } from "@/components/ui";

export default function OrderDetailLoading() {
  return (
    <div aria-busy="true">
      <Skeleton className="h-4 w-64" />
      <Skeleton className="mt-6 h-10 w-80 max-w-full" />
      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-6">
          <Skeleton className="h-72" />
          <Skeleton className="h-64" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-56" />
          <Skeleton className="h-40" />
        </div>
      </div>
    </div>
  );
}

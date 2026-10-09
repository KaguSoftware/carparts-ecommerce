import { Skeleton } from "@/components/ui/Skeleton";

export default function PanelLoading() {
  return (
    <div aria-hidden>
      <Skeleton className="mb-6 h-9 w-64" />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

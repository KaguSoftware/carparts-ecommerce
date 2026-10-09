import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Loading placeholder. Size it with className (h-*, w-*, aspect-*). Hidden from assistive tech. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("skeleton rounded-sm", className)} {...props} />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

/** Convenience product-card skeleton so every loading.tsx grid looks the same. */
export function ProductCardSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <Skeleton className="aspect-square w-full" />
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-5 w-1/4" />
    </div>
  );
}

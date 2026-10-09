import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/** KPI tile: label, number, optional change vs the previous period. Deliberately plain (no hero-metric styling). */
export function StatCard({ label, value, change, hint }: { label: string; value: ReactNode; change?: number; hint?: ReactNode }) {
  const Icon = change === undefined || change === 0 ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <p className="label-caps text-muted">{label}</p>
      <p className="num mt-2 font-display text-[1.75rem] font-bold leading-none text-foreground">{value}</p>
      <div className="mt-2 flex items-center gap-1.5 text-[0.8125rem] text-muted">
        {change !== undefined ? (
          <span className={cn("num inline-flex items-center gap-0.5 font-medium", change > 0 && "text-success", change < 0 && "text-danger")}>
            <Icon className="size-3.5" aria-hidden />
            {Math.abs(change)}%
          </span>
        ) : null}
        {hint ? <span>{hint}</span> : null}
      </div>
    </div>
  );
}

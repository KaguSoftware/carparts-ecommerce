import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LedgerCell {
  label: string;
  value: ReactNode;
  /** Percent change versus the previous period, shown as +54.6% / -3.2% in mono. */
  change?: number;
  hint?: ReactNode;
}

/**
 * One dense, bordered row of figures with hairline dividers and mono numerals: the dashboard ledger.
 * (Replaces four separate KPI cards.) Change values carry a sign so colour is never the only signal.
 */
export function LedgerStrip({ cells, label }: { cells: LedgerCell[]; label: string }) {
  return (
    <dl aria-label={label} className="grid grid-cols-2 border border-border-strong bg-surface lg:grid-cols-4">
      {cells.map((cell, i) => (
        <div key={cell.label} className={cn("min-w-0 border-border px-4 py-3", i % 2 === 1 && "border-l", i >= 2 && "border-t lg:border-t-0", i > 0 && "lg:border-l")}>
          <dt className="tag-mono text-muted">{cell.label}</dt>
          <dd className="mono mt-1 truncate text-[1.5rem] font-semibold leading-none text-foreground">{cell.value}</dd>
          <dd className="mono mt-1.5 flex flex-wrap items-baseline gap-x-2 text-[0.75rem] text-muted">
            {cell.change !== undefined ? (
              <span className={cn("font-semibold", cell.change > 0 && "text-success", cell.change < 0 && "text-danger")}>
                {cell.change > 0 ? "+" : cell.change < 0 ? "-" : "±"}
                {Math.abs(cell.change)}%
              </span>
            ) : null}
            {cell.hint ? <span>{cell.hint}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export interface QueueItem {
  key: string;
  label: string;
  count: number;
  href: string;
  /** Short verb shown on the right ("Review", "Restock"). */
  action: string;
}

/**
 * What staff act on today, ahead of the charts. Cells with work to do are marked; empty ones recede.
 * The count is the first thing read, the verb says what the click does.
 */
export function WorkQueue({ items, label }: { items: QueueItem[]; label: string }) {
  return (
    <nav aria-label={label}>
      <ul className="grid border border-border-strong bg-surface sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, i) => {
          const active = item.count > 0;
          return (
            <li key={item.key} className={cn("border-border", i > 0 && "border-t sm:border-t-0", i % 2 === 1 && "sm:border-l", i >= 2 && "sm:border-t lg:border-t-0", i > 0 && "lg:border-l")}>
              <Link href={item.href} className={cn("group flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-sunken", !active && "text-muted")}>
                <span className={cn("mono min-w-8 text-[1.75rem] font-bold leading-none", active ? "text-foreground" : "text-subtle")}>{item.count}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.875rem] font-medium leading-tight">{item.label}</span>
                  <span className={cn("tag-mono mt-0.5 inline-flex items-center gap-1", active ? "text-primary-text" : "text-subtle")}>
                    {item.action}
                    <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </span>
                {active ? <span aria-hidden className="size-2 shrink-0 bg-primary" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

import { cn } from "@/lib/utils";

export interface ServiceSpecRow {
  key: string;
  value: string;
  note?: string;
}

/**
 * Guarantees as a ruled service-spec table in mono: KEY / VALUE with a hairline between each row. Replaces the
 * icon + heading + text trust row. `label` names the group for assistive tech.
 */
export function ServiceSpec({ rows, label, className, columns = 2 }: { rows: ServiceSpecRow[]; label: string; className?: string; columns?: 1 | 2 | 4 }) {
  return (
    <dl
      aria-label={label}
      className={cn(
        "reg-marks grid border border-border-strong bg-surface",
        columns === 4 && "sm:grid-cols-2 lg:grid-cols-4",
        columns === 2 && "sm:grid-cols-2",
        className,
      )}
    >
      {rows.map((row, i) => (
        <div
          key={row.key}
          className={cn(
            "flex flex-col gap-1.5 border-border px-5 py-4",
            i > 0 && "border-t",
            columns === 2 && "sm:odd:border-l-0 sm:even:border-l sm:[&:nth-child(-n+2)]:border-t-0",
            columns === 4 && "sm:border-t-0 sm:even:border-l sm:[&:nth-child(n+3)]:border-t lg:border-l lg:border-t-0 lg:first:border-l-0 lg:[&:nth-child(n+3)]:border-t-0",
          )}
        >
          <dt className="tag-mono text-muted">{row.key}</dt>
          <dd className="font-display text-[1.375rem] font-semibold uppercase leading-none tracking-wide text-foreground">{row.value}</dd>
          {row.note ? <dd className="text-[0.875rem] leading-snug text-muted">{row.note}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

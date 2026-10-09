import Image from "next/image";
import { cn } from "@/lib/utils";

export interface SpecRow {
  key: string;
  value: string;
  /** 1-3 when this row is drawn as a numbered dimension on the figure. */
  dim?: number;
}

export interface SpecSheetProps {
  rows: SpecRow[];
  figure?: { url: string; alt: string };
  partNumber: string;
  labels: { figure: string; drawing: string; dimensions: string; table: string };
}

/**
 * The specification as a manual-style sheet: a ruled key / value table beside the part drawing. Rows that are
 * measured dimensions carry the same numbered bubbles that are drawn on the figure (see src/lib/spec-dims.ts).
 */
export function SpecSheet({ rows, figure, partNumber, labels }: SpecSheetProps) {
  return (
    <div className={cn("grid gap-8", figure && "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-12")}>
      <dl aria-label={labels.table} className={cn("border-t-2 border-foreground", !figure && "max-w-3xl")}>
        {rows.map((row, i) => (
          <div key={`${row.key}-${i}`} className="flex min-h-12 items-baseline gap-3 border-b border-border py-3 text-[0.9375rem]">
            <span className="flex w-6 shrink-0 justify-center">
              {row.dim !== undefined && figure ? (
                <span aria-hidden className="mono inline-flex size-5 items-center justify-center rounded-full border-2 border-primary-text text-[0.6875rem] font-bold leading-none text-foreground">
                  {row.dim}
                </span>
              ) : (
                <span aria-hidden className="mono text-[0.6875rem] text-subtle">
                  {String(i + 1).padStart(2, "0")}
                </span>
              )}
            </span>
            <dt className="text-muted">
              {row.dim !== undefined && figure ? <span className="sr-only">{labels.dimensions} {row.dim}: </span> : null}
              {row.key}
            </dt>
            <span aria-hidden className="mb-1 min-w-4 flex-1 self-end border-b-2 border-dotted border-border-strong" />
            <dd className={cn("mono min-w-0 max-w-[55%] break-words text-right font-medium text-foreground", row.dim !== undefined && figure && "text-primary-text")}>{row.value}</dd>
          </div>
        ))}
      </dl>

      {figure ? (
        <figure className="reg-marks self-start border border-border-strong bg-surface-sunken lg:sticky lg:top-32">
          <div className="relative aspect-square">
            <Image src={figure.url} alt={figure.alt} fill sizes="(min-width: 1024px) 40vw, 100vw" unoptimized={/\.svg(\?|$)/i.test(figure.url)} className="object-cover" />
          </div>
          <figcaption className="tag-mono flex items-center justify-between gap-3 border-t border-border-strong px-4 py-2.5 text-muted">
            <span>{labels.figure}</span>
            <span className="part-no text-foreground">{partNumber}</span>
          </figcaption>
        </figure>
      ) : null}
    </div>
  );
}

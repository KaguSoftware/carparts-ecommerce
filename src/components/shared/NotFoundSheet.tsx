import type { ReactNode } from "react";

/**
 * 404 as a drawing sheet: a part outlined in dashes (the thing that is missing), a "?" dimension bubble and a
 * title block that reads NOT FOUND. Used by both not-found pages so the identity carries past the storefront.
 */
export function NotFoundSheet({ code, status, drawing, children }: { code: string; status: string; drawing: string; children?: ReactNode }) {
  return (
    <div className="reg-marks sheet-grid relative border border-sheet-line bg-sheet text-sheet-ink [--reg-c:var(--sheet-line)]">
      <div className="grid items-center gap-6 px-6 pb-6 pt-10 sm:grid-cols-[minmax(0,15rem)_1fr] sm:px-10">
        <svg viewBox="0 0 240 240" role="img" aria-label={drawing} className="mx-auto block h-auto w-full max-w-60">
          <g fill="none" strokeLinecap="round">
            <circle cx="120" cy="112" r="84" className="stroke-sheet-ink" strokeWidth="2.4" strokeDasharray="9 7" />
            <circle cx="120" cy="112" r="48" className="stroke-sheet-muted" strokeWidth="1.2" strokeDasharray="4 6" />
            <circle cx="120" cy="112" r="14" className="stroke-sheet-ink" strokeWidth="2.4" strokeDasharray="5 5" />
            <line x1="14" y1="112" x2="226" y2="112" className="stroke-sheet-accent" strokeWidth="1.1" strokeDasharray="22 5 3 5" />
            <line x1="120" y1="6" x2="120" y2="218" className="stroke-sheet-accent" strokeWidth="1.1" strokeDasharray="22 5 3 5" />
            <g strokeWidth="1.2" className="stroke-sheet-ink">
              <line x1="36" y1="210" x2="204" y2="210" />
              <line x1="36" y1="204" x2="36" y2="216" />
              <line x1="204" y1="204" x2="204" y2="216" />
            </g>
          </g>
          <circle cx="120" cy="210" r="15" className="fill-sheet stroke-sheet-accent" strokeWidth="2.2" />
          <text x="120" y="216" textAnchor="middle" className="mono fill-sheet-ink" fontSize="17" fontWeight="700">
            ?
          </text>
        </svg>
        <div className="min-w-0 space-y-3">{children}</div>
      </div>
      <dl className="grid grid-cols-3 border-t border-sheet-ink">
        <div className="px-4 py-2.5">
          <dt className="tag-mono text-sheet-muted">DWG</dt>
          <dd className="part-no mt-0.5 text-[0.9375rem]">{code}</dd>
        </div>
        <div className="border-l border-sheet-line px-4 py-2.5">
          <dt className="tag-mono text-sheet-muted">REV</dt>
          <dd className="part-no mt-0.5 text-[0.9375rem]">&ndash;</dd>
        </div>
        <div className="border-l border-sheet-line px-4 py-2.5">
          <dt className="tag-mono text-sheet-muted">STATUS</dt>
          <dd className="part-no mt-0.5 text-[0.9375rem] text-sheet-accent">{status}</dd>
        </div>
      </dl>
    </div>
  );
}

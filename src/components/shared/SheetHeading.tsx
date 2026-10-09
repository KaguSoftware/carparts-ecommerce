import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export interface SheetHeadingProps {
  id?: string;
  /** Sheet number, rendered as "§ 02". */
  n?: number | string;
  title: ReactNode;
  /** Mono note after the rule, e.g. "15 PARTS". */
  meta?: ReactNode;
  href?: string;
  linkLabel?: string;
  as?: "h2" | "h3";
  size?: "lg" | "md";
  className?: string;
}

const pad = (n: number | string) => (typeof n === "number" ? String(n).padStart(2, "0") : n);

/**
 * Section header in the workshop-manual idiom: the sheet number and the title share one baseline and a hairline
 * ruler carries the eye to the right edge, where the section's link (or a mono note) waits.
 */
export function SheetHeading({ id, n, title, meta, href, linkLabel, as = "h2", size = "lg", className }: SheetHeadingProps) {
  const Tag = as;
  return (
    <div className={cn("flex flex-wrap items-end gap-x-4 gap-y-2", className)}>
      <Tag id={id} className={cn("flex items-baseline gap-3 sm:gap-4", size === "lg" ? "display-2" : "display-3")}>
        {n !== undefined ? (
          <span aria-hidden className="mono text-[0.38em] font-medium normal-case tracking-[0.08em] text-primary-text">
            § {pad(n)}
          </span>
        ) : null}
        <span>{title}</span>
      </Tag>
      <span aria-hidden className="ruler mb-2.5 hidden min-w-8 flex-1 sm:block" />
      {href && linkLabel ? (
        <Link
          href={href}
          className="group tag-mono mb-1 ml-auto inline-flex min-h-9 items-center gap-1.5 text-foreground transition-colors hover:text-primary-text sm:ml-0"
        >
          <span className="underline-offset-4 group-hover:underline">{linkLabel}</span>
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      ) : meta ? (
        <span className="tag-mono mb-2 ml-auto text-muted sm:ml-0">{meta}</span>
      ) : null}
    </div>
  );
}

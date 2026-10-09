import Image from "next/image";
import { cn } from "@/lib/utils";

export interface CatalogHeroProps {
  title: string;
  description?: string;
  /** Line-drawing plate on the right (public path). It carries its own graphite background. */
  image?: string;
  /** Small logo/badge shown before the title (brand pages). */
  badge?: React.ReactNode;
  /** Sheet number shown as "§ 03" before the title. */
  section?: number | string;
  /** Mono count line under the title, e.g. "15 PARTS / 4 SUB-ASSEMBLIES". */
  meta?: string;
  children?: React.ReactNode;
  className?: string;
}

const pad = (n: number | string) => (typeof n === "number" ? String(n).padStart(2, "0") : n);

/**
 * Compact page header in the workshop-manual idiom: sheet number, the name in big condensed type, a mono count,
 * and a small drawing plate at the right. The dark full-width band belongs to the home page alone.
 */
export function CatalogHero({ title, description, image, badge, section, meta, children, className }: CatalogHeroProps) {
  return (
    <section className={cn("border-y border-border-strong bg-surface", className)}>
      <div className="container-page py-7 md:py-9">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-stretch lg:gap-10">
          <div className="flex min-w-0 flex-col justify-center gap-4 sm:flex-row sm:items-center sm:justify-start">
            {badge}
            <div className="min-w-0">
              <h1 className="display-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                {section !== undefined ? (
                  <span aria-hidden className="mono text-[0.22em] font-medium normal-case tracking-[0.08em] text-primary-text">
                    § {pad(section)}
                  </span>
                ) : null}
                <span className="min-w-0 break-words">{title}</span>
              </h1>
              {meta ? <p className="tag-mono mt-3 text-foreground">{meta}</p> : null}
              {description ? <p className="mt-3 max-w-xl text-[1.0625rem] text-muted">{description}</p> : null}
            </div>
          </div>
          {image ? (
            <div aria-hidden className="reg-marks relative h-28 overflow-hidden border border-inverse-border bg-inverse [--reg-c:var(--inverse-muted)] sm:h-36 lg:h-auto lg:min-h-36">
              <Image src={image} alt="" fill priority sizes="(min-width: 1024px) 21rem, 100vw" unoptimized={/\.svg(\?|$)/i.test(image)} className="object-contain" />
            </div>
          ) : null}
        </div>
        {children}
      </div>
    </section>
  );
}

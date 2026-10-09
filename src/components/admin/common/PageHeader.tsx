import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}

/** Page title row: optional back link, title + description on the left, primary actions on the right. */
export function PageHeader({ title, description, actions, back }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 print:hidden">
      <div className="min-w-0">
        {back ? (
          <Link href={back.href} className="mb-1.5 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
            <ChevronLeft className="size-4" aria-hidden />
            {back.label}
          </Link>
        ) : null}
        <h1 className="text-[1.75rem] leading-none tracking-wide sm:text-[2rem]">{title}</h1>
        {description ? <p className="mt-2 max-w-prose text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

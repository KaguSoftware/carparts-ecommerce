import type { ReactNode } from "react";

/** Title block shared by every account page: one `h1`, optional supporting copy and a right-aligned action. */
export function AccountPageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
      <div className="min-w-0">
        <h1 className="display-3">{title}</h1>
        {description ? <p className="mt-2 max-w-prose text-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

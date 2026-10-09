import { Link } from "@/i18n/navigation";

export interface SubcategoryNavProps {
  label: string;
  items: { slug: string; name: string; count: number }[];
}

/** Subcategories as a ruled table of contents: number, name, dotted leader, part count. */
export function SubcategoryNav({ label, items }: SubcategoryNavProps) {
  if (items.length === 0) return null;
  return (
    <nav aria-label={label} className="mt-7">
      <ol className="grid gap-x-10 border-t-2 border-foreground sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <li key={item.slug} className="border-b border-border">
            <Link href={`/category/${item.slug}`} className="group flex min-h-11 items-baseline gap-3 py-2.5">
              <span className="mono w-6 shrink-0 text-[0.75rem] font-medium text-subtle">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-[0.9375rem] font-semibold text-foreground transition-colors group-hover:text-primary-text group-hover:underline group-hover:underline-offset-4">{item.name}</span>
              <span aria-hidden className="mb-1 min-w-4 flex-1 self-end border-b-2 border-dotted border-border-strong" />
              <span className="num shrink-0 font-mono text-[0.8125rem] font-medium text-foreground">{item.count}</span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

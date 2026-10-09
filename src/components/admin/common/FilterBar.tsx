import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

/**
 * Filters are a plain GET form: the URL is the state, so lists are server-rendered, linkable and need no client JS.
 * `hidden` keeps other params (sort, page size) when the filters are applied.
 */
export function FilterBar({ action, children, hidden, resetHref }: { action: string; children: ReactNode; hidden?: Record<string, string | undefined>; resetHref?: string }) {
  const t = useTranslations("admin.common");
  return (
    <form method="get" action={action} className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-border bg-surface p-3 print:hidden">
      {Object.entries(hidden ?? {}).map(([name, value]) => (value ? <input key={name} type="hidden" name={name} value={value} /> : null))}
      {children}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" variant="secondary">
          {t("apply")}
        </Button>
        <Link href={resetHref ?? action} className={buttonStyles({ variant: "ghost", size: "sm" })}>
          {t("reset")}
        </Link>
      </div>
    </form>
  );
}

export function FilterField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex min-w-[9rem] flex-col gap-1 ${className ?? ""}`}>
      <span className="label-caps text-muted">{label}</span>
      {children}
    </label>
  );
}

export function SearchFilter({ name = "q", value, placeholder, label }: { name?: string; value?: string; placeholder?: string; label?: string }) {
  const t = useTranslations("admin.common");
  return (
    <FilterField label={label ?? t("search")} className="min-w-[14rem] flex-1">
      <Input size="sm" type="search" name={name} defaultValue={value ?? ""} placeholder={placeholder ?? t("searchPlaceholder")} leading={<Search />} />
    </FilterField>
  );
}

export function SelectFilter({
  name,
  label,
  value,
  options,
  allLabel,
}: {
  name: string;
  label: string;
  value?: string;
  options: { value: string; label: string }[];
  /** Label of the empty option; omit to have no "all" option. */
  allLabel?: string;
}) {
  return (
    <FilterField label={label}>
      <Select size="sm" name={name} defaultValue={value ?? ""}>
        {allLabel !== undefined ? <option value="">{allLabel}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </FilterField>
  );
}

export function DateFilter({ name, label, value }: { name: string; label: string; value?: string }) {
  return (
    <FilterField label={label}>
      <Input size="sm" type="date" name={name} defaultValue={value ?? ""} />
    </FilterField>
  );
}

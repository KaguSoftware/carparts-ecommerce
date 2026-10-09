import Link from "next/link";
import { useTranslations } from "next-intl";
import { Pagination } from "@/components/ui/Pagination";
import { hrefWith, type SearchParams } from "../lib/params";

/** "1-25 of 130" + pagination links that keep every other query param. */
export function ListFooter({ base, sp, page, pageSize, total, pageCount }: { base: string; sp: SearchParams; page: number; pageSize: number; total: number; pageCount: number }) {
  const t = useTranslations("common.pagination");
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
      <p className="num text-sm text-muted">{t("range", { from, to, total })}</p>
      <Pagination page={page} pageCount={pageCount} linkAs={Link} buildHref={(p) => hrefWith(base, sp, { page: p === 1 ? null : p })} className="justify-end" />
    </div>
  );
}

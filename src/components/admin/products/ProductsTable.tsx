"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Archive, Eye, EyeOff, Pencil, Star, StarOff, Trash2 } from "lucide-react";
import { bulkProductsAction, deleteProductAction } from "@/actions/admin/products";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Table, TableContainer, TableEmpty, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { formatMoney } from "@/lib/money";
import { ConfirmActionButton } from "../common/ConfirmActionButton";
import { StatusBadge } from "../common/StatusBadge";
import { useAdminAction } from "../forms/use-admin-action";

export interface ProductTableRow {
  id: string;
  name: string;
  partNumber: string;
  image?: string;
  brand: string;
  category: string;
  status: "draft" | "active" | "archived";
  isFeatured: boolean;
  variantCount: number;
  priceFrom: number;
  totalAvailable: number;
  lowStock: boolean;
  updatedAt: string;
}

export interface SortLink {
  state: "asc" | "desc" | "none";
  href: string;
}

type BulkOp = "publish" | "draft" | "archive" | "delete" | "feature" | "unfeature";

export function ProductsTable({ rows, sorts, canWrite }: { rows: ProductTableRow[]; sorts: Record<"name" | "price" | "stock" | "updated", SortLink>; canWrite: boolean }) {
  const t = useTranslations("admin.products.list");
  const locale = useLocale();
  const format = useFormatter();
  const { run, pending } = useAdminAction();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const ids = useMemo(() => [...selected], [selected]);

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const bulk = (op: BulkOp) =>
    run(() => bulkProductsAction({ ids, op }), {
      onSuccess: () => setSelected(new Set()),
      success: t(`bulk.done_${op}`),
    });

  const cols = canWrite ? 9 : 7;

  return (
    <div>
      {canWrite && selected.size > 0 ? (
        <div role="region" aria-label={t("bulk.label")} className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-primary bg-primary-soft px-3 py-2">
          <span className="num mr-2 text-sm font-medium">{t("bulk.selected", { count: selected.size })}</span>
          <Button size="sm" variant="outline" disabled={pending} leftIcon={<Eye className="size-4" />} onClick={() => void bulk("publish")}>
            {t("bulk.publish")}
          </Button>
          <Button size="sm" variant="outline" disabled={pending} leftIcon={<EyeOff className="size-4" />} onClick={() => void bulk("draft")}>
            {t("bulk.draft")}
          </Button>
          <Button size="sm" variant="outline" disabled={pending} leftIcon={<Archive className="size-4" />} onClick={() => void bulk("archive")}>
            {t("bulk.archive")}
          </Button>
          <Button size="sm" variant="outline" disabled={pending} leftIcon={<Star className="size-4" />} onClick={() => void bulk("feature")}>
            {t("bulk.feature")}
          </Button>
          <Button size="sm" variant="outline" disabled={pending} leftIcon={<StarOff className="size-4" />} onClick={() => void bulk("unfeature")}>
            {t("bulk.unfeature")}
          </Button>
          <ConfirmActionButton
            variant="danger"
            action={bulkProductsAction.bind(null, { ids, op: "delete" })}
            title={t("bulk.deleteTitle", { count: selected.size })}
            description={t("bulk.deleteBody")}
            confirmLabel={t("bulk.deleteConfirm")}
            success={t("bulk.done_delete")}
            leftIcon={<Trash2 className="size-4" />}
            onDone={() => setSelected(new Set())}
          >
            {t("bulk.delete")}
          </ConfirmActionButton>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
            {t("bulk.clear")}
          </Button>
        </div>
      ) : null}

      <TableContainer>
        <Table caption={t("caption")} dense>
          <THead>
            <Tr>
              {canWrite ? (
                <Th className="w-10">
                  <Checkbox aria-label={t("selectAll")} checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))} />
                </Th>
              ) : null}
              <Th sort={sorts.name.state} href={sorts.name.href} linkAs={Link}>
                {t("cols.product")}
              </Th>
              <Th>{t("cols.brand")}</Th>
              <Th>{t("cols.category")}</Th>
              <Th>{t("cols.status")}</Th>
              <Th numeric sort={sorts.price.state} href={sorts.price.href} linkAs={Link}>
                {t("cols.price")}
              </Th>
              <Th numeric sort={sorts.stock.state} href={sorts.stock.href} linkAs={Link}>
                {t("cols.stock")}
              </Th>
              <Th className="hidden 2xl:table-cell" sort={sorts.updated.state} href={sorts.updated.href} linkAs={Link}>
                {t("cols.updated")}
              </Th>
              {canWrite ? (
                <Th className="w-px">
                  <span className="sr-only">{t("cols.actions")}</span>
                </Th>
              ) : null}
            </Tr>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <TableEmpty colSpan={cols}>{t("empty")}</TableEmpty>
            ) : (
              rows.map((r) => (
                <Tr key={r.id} aria-selected={selected.has(r.id)}>
                  {canWrite ? (
                    <Td>
                      <Checkbox aria-label={t("select", { name: r.name })} checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                    </Td>
                  ) : null}
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="size-10 shrink-0 overflow-hidden rounded-sm border border-border bg-surface-sunken">
                        {r.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.image} alt="" width={40} height={40} loading="lazy" className="size-full object-contain" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <Link href={`/admin/products/${r.id}`} className="block max-w-56 truncate font-medium text-foreground hover:text-primary-text hover:underline">
                          {r.name}
                        </Link>
                        <span className="part-no text-xs text-muted">{r.partNumber}</span>
                        {r.isFeatured ? (
                          <Badge tone="accent" className="ml-2 px-1.5 py-0.5 text-[0.6875rem]">
                            {t("featured")}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-muted">{r.brand}</Td>
                  <Td className="max-w-32 truncate text-muted">{r.category}</Td>
                  <Td>
                    <StatusBadge kind="product" value={r.status} />
                  </Td>
                  <Td numeric>
                    {r.variantCount > 1 ? <span className="mr-1 text-xs text-muted">{t("from")}</span> : null}
                    {formatMoney(r.priceFrom, locale)}
                  </Td>
                  <Td numeric>
                    <span className={r.totalAvailable <= 0 ? "text-danger" : r.lowStock ? "text-warning" : undefined}>{r.totalAvailable}</span>
                    {r.lowStock && r.totalAvailable > 0 ? <span className="sr-only"> {t("lowStock")}</span> : null}
                  </Td>
                  <Td className="hidden whitespace-nowrap text-muted 2xl:table-cell">{format.dateTime(new Date(r.updatedAt), { dateStyle: "medium" })}</Td>
                  {canWrite ? (
                    <Td>
                      <div className="flex justify-end gap-1">
                        <Link href={`/admin/products/${r.id}`} aria-label={t("edit", { name: r.name })} title={t("edit", { name: r.name })} className="inline-flex size-9 items-center justify-center rounded-sm text-muted hover:bg-surface-sunken hover:text-foreground">
                          <Pencil className="size-4" aria-hidden />
                        </Link>
                        <ConfirmActionButton
                          size="icon-sm"
                          aria-label={t("delete", { name: r.name })}
                          action={deleteProductAction.bind(null, { id: r.id })}
                          title={t("deleteTitle", { name: r.name })}
                          description={t("deleteBody")}
                          confirmLabel={t("deleteConfirm")}
                          success={t("deleted")}
                        >
                          <Trash2 className="size-4" />
                        </ConfirmActionButton>
                      </div>
                    </Td>
                  ) : null}
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </TableContainer>
    </div>
  );
}

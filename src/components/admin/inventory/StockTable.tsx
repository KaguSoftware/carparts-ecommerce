"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Table, TableContainer, TableEmpty, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { StatusBadge } from "../common/StatusBadge";
import { StockAdjustDialog, type StockTarget } from "./StockAdjustDialog";

export interface StockRow {
  variantId: string;
  productId: string;
  sku: string;
  product: string;
  variant: string;
  brand: string;
  onHand: number;
  reserved: number;
  available: number;
  threshold: number;
  isActive: boolean;
  status: "in_stock" | "low_stock" | "out_of_stock";
}

export function StockTable({ rows, canAdjust, sortHref, sortState }: { rows: StockRow[]; canAdjust: boolean; sortHref: string; sortState: "asc" | "desc" | "none" }) {
  const t = useTranslations("admin.inventory");
  const [target, setTarget] = useState<StockTarget | null>(null);
  return (
    <>
      <TableContainer>
        <Table dense caption={t("stockCaption")}>
          <THead>
            <Tr>
              <Th>{t("cols.sku")}</Th>
              <Th>{t("cols.product")}</Th>
              <Th numeric>{t("cols.onHand")}</Th>
              <Th numeric>{t("cols.reserved")}</Th>
              <Th numeric sort={sortState} href={sortHref} linkAs={Link}>
                {t("cols.available")}
              </Th>
              <Th numeric>{t("cols.threshold")}</Th>
              <Th>{t("cols.status")}</Th>
              {canAdjust ? (
                <Th className="w-px">
                  <span className="sr-only">{t("cols.actions")}</span>
                </Th>
              ) : null}
            </Tr>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <TableEmpty colSpan={8}>{t("emptyStock")}</TableEmpty>
            ) : (
              rows.map((r) => (
                <Tr key={r.variantId}>
                  <Td className="part-no">{r.sku}</Td>
                  <Td>
                    <Link href={`/admin/products/${r.productId}`} className="block max-w-80 truncate hover:text-primary-text hover:underline">
                      {r.product}
                    </Link>
                    <span className="block max-w-80 truncate text-xs text-muted">
                      {r.brand}
                      {r.variant ? ` · ${r.variant}` : ""}
                      {!r.isActive ? ` · ${t("inactive")}` : ""}
                    </span>
                  </Td>
                  <Td numeric>{r.onHand}</Td>
                  <Td numeric className="text-muted">
                    {r.reserved}
                  </Td>
                  <Td numeric className="font-medium">
                    {r.available}
                  </Td>
                  <Td numeric className="text-muted">
                    {r.threshold}
                  </Td>
                  <Td>
                    <StatusBadge kind="stock" value={r.status} />
                  </Td>
                  {canAdjust ? (
                    <Td>
                      <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<SlidersHorizontal className="size-4" />}
                        onClick={() => setTarget({ variantId: r.variantId, sku: r.sku, label: `${r.product}${r.variant ? ` · ${r.variant}` : ""}`, onHand: r.onHand, reserved: r.reserved })}
                      >
                        {t("adjustButton")}
                      </Button>
                    </Td>
                  ) : null}
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </TableContainer>
      <StockAdjustDialog target={target} onClose={() => setTarget(null)} />
    </>
  );
}

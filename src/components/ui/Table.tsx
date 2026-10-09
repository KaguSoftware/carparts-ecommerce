import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LinkAs as LinkAsType } from "./link-as";

/**
 * Data table primitives. Server-component friendly (no state). Wrap with a client component for
 * selection / client-side sorting. The wrapper scrolls horizontally on small screens.
 *
 *   <TableContainer>
 *     <Table caption="Orders">
 *       <THead><Tr><Th sort="asc" href="?sort=-number">Order</Th><Th numeric>Total</Th></Tr></THead>
 *       <TBody>{rows.map(r => <Tr key={r.id}><Td>{r.number}</Td><Td numeric>{r.total}</Td></Tr>)}</TBody>
 *     </Table>
 *   </TableContainer>
 */
export function TableContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative w-full overflow-x-auto rounded-md border border-border bg-surface", className)} {...props} />;
}

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /** Accessible name for the table (rendered as a visually hidden <caption>). */
  caption?: ReactNode;
  dense?: boolean;
}

export function Table({ caption, dense, className, children, ...props }: TableProps) {
  return (
    <table className={cn("w-full border-collapse text-left text-sm", dense ? "[&_td]:py-2 [&_th]:py-2" : "[&_td]:py-3.5 [&_th]:py-3", className)} {...props}>
      {caption ? <caption className="sr-only">{caption}</caption> : null}
      {children}
    </table>
  );
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("border-b border-border-strong bg-surface-sunken", className)} {...props} />;
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-border", className)} {...props} />;
}

export function TFoot({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tfoot className={cn("border-t border-border-strong bg-surface-sunken font-medium", className)} {...props} />;
}

export function Tr({ className, clickable, ...props }: HTMLAttributes<HTMLTableRowElement> & { clickable?: boolean }) {
  return <tr className={cn("transition-colors", clickable ? "hover:bg-surface-sunken" : "hover:bg-surface-sunken/60", className)} {...props} />;
}

export interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
  /** Current sort direction for this column, or "none" if sortable but inactive. Omit when not sortable. */
  sort?: "asc" | "desc" | "none";
  /** When sortable: render the header as a link (server-friendly sorting through the URL). */
  href?: string;
  /** Link component (default: plain <a>). Pass next/link or the locale-aware Link. */
  linkAs?: LinkAsType;
}

export function Th({ numeric, sort, href, linkAs: LinkAs = "a", className, children, ...props }: ThProps) {
  const Icon = sort === "asc" ? ArrowUp : sort === "desc" ? ArrowDown : ChevronsUpDown;
  return (
    <th
      scope="col"
      aria-sort={sort === "asc" ? "ascending" : sort === "desc" ? "descending" : sort === "none" ? "none" : undefined}
      className={cn("label-caps whitespace-nowrap px-4 text-muted", numeric && "text-right", className)}
      {...props}
    >
      {sort && href ? (
        <LinkAs href={href} className={cn("inline-flex items-center gap-1.5 hover:text-foreground", sort !== "none" && "text-foreground")}>
          {children}
          <Icon className="size-3.5" aria-hidden />
        </LinkAs>
      ) : (
        children
      )}
    </th>
  );
}

export interface TdProps extends TdHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
}

export function Td({ numeric, className, ...props }: TdProps) {
  return <td className={cn("px-4 align-middle", numeric && "num text-right", className)} {...props} />;
}

/** Full-width empty state row for a table body. */
export function TableEmpty({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-14 text-center text-muted">
        {children}
      </td>
    </tr>
  );
}

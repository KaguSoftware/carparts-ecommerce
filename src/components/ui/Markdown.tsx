import { Fragment, type ReactNode } from "react";
import type { LinkAs as LinkAsType } from "./link-as";
import { cn } from "@/lib/utils";

/**
 * Safe markdown-subset renderer for CMS pages and product descriptions (ARCHITECTURE.md > Security baseline).
 * Supports: headings (#..####), paragraphs, bullet and numbered lists, **bold**, *italic*, links
 * (http/https/relative only), tables, horizontal rules. Raw HTML is never interpreted: it renders as text.
 * Server component; pass `linkAs` (storefront: `Link` from "@/i18n/navigation") to localise internal links.
 */
export interface MarkdownProps {
  source: string;
  linkAs?: LinkAsType;
  className?: string;
  /** Heading level used for `#` (the page already owns the h1 by default, so `##` maps to h2 and `#` to h2 as well). */
  baseLevel?: 2 | 3;
}

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "hr" };

function isSafeHref(href: string): boolean {
  const h = href.trim();
  if (h.startsWith("/") && !h.startsWith("//")) return true;
  return /^https?:\/\//i.test(h);
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

const isTableSeparator = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line) && line.includes("-");

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: (heading[1] as string).length, text: (heading[2] as string).trim() });
      i++;
      continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1] ?? "")) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && (lines[i] ?? "").includes("|") && (lines[i] ?? "").trim()) {
        rows.push(splitRow(lines[i] as string));
        i++;
      }
      blocks.push({ type: "table", head, rows });
      continue;
    }
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const ordered = !bullet;
      const items: string[] = [];
      while (i < lines.length) {
        const m = ordered ? /^\s*\d+[.)]\s+(.*)$/.exec(lines[i] ?? "") : /^\s*[-*+]\s+(.*)$/.exec(lines[i] ?? "");
        if (!m) break;
        items.push((m[1] as string).trim());
        i++;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && (lines[i] ?? "").trim() && !/^(#{1,4})\s+/.test(lines[i] ?? "") && !/^\s*[-*+]\s+/.test(lines[i] ?? "") && !/^\s*\d+[.)]\s+/.test(lines[i] ?? "")) {
      if ((lines[i] ?? "").includes("|") && isTableSeparator(lines[i + 1] ?? "")) break;
      para.push((lines[i] as string).trim());
      i++;
    }
    blocks.push({ type: "paragraph", text: para.join(" ") });
  }
  return blocks;
}

const INLINE = /(\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_)/;

function renderInline(text: string, LinkAs: LinkAsType, keyPrefix = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let n = 0;
  while (rest) {
    const m = INLINE.exec(rest);
    if (!m) {
      out.push(rest);
      break;
    }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    const key = `${keyPrefix}-${n++}`;
    if (m[2] !== undefined && m[3] !== undefined) {
      const label = renderInline(m[2], LinkAs, key);
      if (isSafeHref(m[3])) {
        const external = /^https?:/i.test(m[3]);
        out.push(
          external ? (
            <a key={key} href={m[3]} rel="noopener noreferrer" target="_blank" className="text-primary-text underline underline-offset-4 hover:no-underline">
              {label}
            </a>
          ) : (
            <LinkAs key={key} href={m[3]} className="text-primary-text underline underline-offset-4 hover:no-underline">
              {label}
            </LinkAs>
          ),
        );
      } else {
        out.push(<Fragment key={key}>{label}</Fragment>);
      }
    } else if (m[4] !== undefined || m[5] !== undefined) {
      out.push(<strong key={key} className="font-semibold text-foreground">{renderInline((m[4] ?? m[5]) as string, LinkAs, key)}</strong>);
    } else {
      out.push(<em key={key}>{renderInline((m[6] ?? m[7]) as string, LinkAs, key)}</em>);
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

export function Markdown({ source, linkAs: LinkAs = "a", className, baseLevel = 2 }: MarkdownProps) {
  const blocks = parseBlocks(source);
  return (
    <div className={cn("space-y-4 text-[1.0625rem] leading-relaxed text-foreground/90", className)}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "heading": {
            const level = Math.min(4, Math.max(baseLevel, block.level + (baseLevel - 2)));
            const Tag = `h${level}` as "h2" | "h3" | "h4";
            return (
              <Tag key={idx} className={cn("text-foreground", level === 2 ? "display-3 pt-6" : level === 3 ? "display-4 pt-4" : "label-caps pt-2")}>
                {renderInline(block.text, LinkAs, `h${idx}`)}
              </Tag>
            );
          }
          case "paragraph":
            return <p key={idx}>{renderInline(block.text, LinkAs, `p${idx}`)}</p>;
          case "list": {
            const Tag = block.ordered ? "ol" : "ul";
            return (
              <Tag key={idx} className={cn("space-y-2 pl-6", block.ordered ? "list-decimal" : "list-disc", "marker:text-primary-text")}>
                {block.items.map((item, j) => (
                  <li key={j} className="pl-1">
                    {renderInline(item, LinkAs, `l${idx}-${j}`)}
                  </li>
                ))}
              </Tag>
            );
          }
          case "table":
            return (
              <div key={idx} className="overflow-x-auto rounded-md border border-border">
                <table className="w-full min-w-[20rem] border-collapse text-left text-[0.9375rem]">
                  <thead className="bg-surface-sunken">
                    <tr>
                      {block.head.map((h, j) => (
                        <th key={j} scope="col" className="label-caps px-4 py-3 text-foreground">
                          {renderInline(h, LinkAs, `th${idx}-${j}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r} className="border-t border-border">
                        {row.map((cell, c) => (
                          <td key={c} className="num px-4 py-3 align-top">
                            {renderInline(cell, LinkAs, `td${idx}-${r}-${c}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "hr":
            return <hr key={idx} className="border-border" />;
        }
      })}
    </div>
  );
}

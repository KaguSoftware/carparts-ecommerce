import "server-only";
/**
 * Minimal RFC 4180 CSV reader/writer used by product import/export, order export and subscriber export.
 * Export guards against spreadsheet formula injection (cells starting with = + - @ TAB CR get a leading ').
 */

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: unknown, opts: { numeric?: boolean } = {}): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "string" ? value : String(value);
  if (!opts.numeric && FORMULA_START.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(header: readonly string[], rows: readonly (readonly unknown[])[], numericColumns: ReadonlySet<number> = new Set()): string {
  const lines = [header.map((h) => csvCell(h)).join(",")];
  for (const row of rows) lines.push(row.map((cell, i) => csvCell(cell, { numeric: numericColumns.has(i) && typeof cell === "number" })).join(","));
  return lines.join("\r\n") + "\r\n";
}

export class CsvParseError extends Error {}

/** Parses CSV text into rows of strings. Handles BOM, CRLF/LF, quoted fields, escaped quotes, newlines in quotes. */
export function parseCsv(input: string, maxRows = 20_000): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
    if (rows.length > maxRows) throw new CsvParseError("too many rows");
    row = [];
  };
  while (i < text.length) {
    const ch = text[i] as string;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field === "") {
      inQuotes = true;
      i++;
    } else if (ch === ",") {
      pushField();
      i++;
    } else if (ch === "\r") {
      if (text[i + 1] === "\n") i++;
      pushRow();
      i++;
    } else if (ch === "\n") {
      pushRow();
      i++;
    } else {
      field += ch;
      i++;
    }
  }
  if (inQuotes) throw new CsvParseError("unterminated quote");
  if (field !== "" || row.length > 0) pushRow();
  return rows;
}

/** Undo the formula-guard apostrophe added by `csvCell`. */
export function unguardCell(value: string): string {
  return /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value;
}

/** Parse into objects keyed by lower-cased header names. */
export function parseCsvRecords(input: string, maxRows?: number): { header: string[]; records: Record<string, string>[] } {
  const rows = parseCsv(input, maxRows);
  if (rows.length === 0) throw new CsvParseError("empty file");
  const header = (rows[0] as string[]).map((h) => h.trim().toLowerCase());
  const records = rows.slice(1).map((r) => {
    const rec: Record<string, string> = {};
    header.forEach((h, idx) => {
      rec[h] = unguardCell((r[idx] ?? "").trim());
    });
    return rec;
  });
  return { header, records };
}

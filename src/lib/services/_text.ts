import "server-only";
/**
 * Text folding and scoring shared by catalog (free-text filter) and search (ranking, autocomplete).
 * Case/diacritic-insensitive, Turkish aware (dotted/dotless i, s/g/c/o/u cedillas and umlauts fold to ASCII).
 * Pure functions, no I/O.
 */

const TR_FOLD: Record<string, string> = {
  "ı": "i",
  "İ": "i",
  "I": "i",
  "ş": "s",
  "Ş": "s",
  "ğ": "g",
  "Ğ": "g",
  "ç": "c",
  "Ç": "c",
  "ö": "o",
  "Ö": "o",
  "ü": "u",
  "Ü": "u",
  "â": "a",
  "î": "i",
  "û": "u",
};

/** Lower-case ASCII-ish form with punctuation turned into single spaces. "Fren Balatası (Ön)" -> "fren balatasi on". */
export function fold(input: string): string {
  let out = "";
  for (const ch of input) out += TR_FOLD[ch] ?? ch;
  return out
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Alphanumerics only, for part numbers and SKUs: "BP-1234/A" -> "bp1234a". */
export function compact(input: string): string {
  return fold(input).replace(/ /g, "");
}

export function tokenize(input: string): string[] {
  const folded = fold(input);
  return folded ? folded.split(" ").filter(Boolean) : [];
}

/** Light plural/suffix variants so "pads" matches "pad" and "filtreler" matches "filtre". */
export function tokenVariants(token: string): string[] {
  const variants = new Set<string>([token]);
  if (token.length >= 4 && token.endsWith("s")) variants.add(token.slice(0, -1));
  if (token.length >= 5 && token.endsWith("es")) variants.add(token.slice(0, -2));
  if (token.length >= 6 && (token.endsWith("ler") || token.endsWith("lar"))) variants.add(token.slice(0, -3));
  // Turkish compound/possessive endings: balatasi -> balata, filtreleri -> filtre
  if (token.length >= 7 && (token.endsWith("leri") || token.endsWith("lari"))) variants.add(token.slice(0, -4));
  if (token.length >= 6 && (token.endsWith("si") || token.endsWith("su"))) variants.add(token.slice(0, -2));
  return [...variants];
}

export function levenshtein(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0] as number;
    prev[0] = i;
    let rowMin = prev[0] as number;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j] as number;
      prev[j] = Math.min((prev[j] as number) + 1, (prev[j - 1] as number) + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
      if ((prev[j] as number) < rowMin) rowMin = prev[j] as number;
    }
    if (rowMin > max) return max + 1;
  }
  return prev[b.length] as number;
}

/** Pre-folded searchable view of one product. Built once per query, per product. */
export interface SearchDoc {
  id: string;
  /** compact codes: part number, SKUs, OEM numbers */
  codes: string[];
  names: string[]; // folded names (all locales)
  nameWords: string[][]; // per name: word list
  brand: string;
  categories: string[];
  tags: string[];
  summary: string;
  description: string;
}

export interface Scored {
  score: number;
  matchedOn?: "sku" | "partNumber" | "oem";
}

/**
 * Relevance score; 0 = no match. Every query token must match something (AND).
 * Weights: exact part number 1000 > code prefix 400 > code contains 150 > name phrase 300 > name word prefix 60 >
 * name substring 30 > brand 40 > tag 25 > category 20 > summary 8 > description 2.
 */
export function scoreDoc(doc: SearchDoc, rawQuery: string, tokens: string[], localeNameIndex?: number): number {
  if (tokens.length === 0) return 0;
  const queryCompact = compact(rawQuery);
  let bonus = 0;

  if (queryCompact.length >= 3) {
    for (const code of doc.codes) {
      if (code === queryCompact) bonus = Math.max(bonus, 1000);
      else if (code.startsWith(queryCompact)) bonus = Math.max(bonus, 400);
      else if (queryCompact.length >= 4 && code.includes(queryCompact)) bonus = Math.max(bonus, 150);
    }
  }

  const phrase = tokens.join(" ");
  let total = 0;
  for (const token of tokens) {
    const variants = tokenVariants(token);
    let best = 0;
    for (const v of variants) {
      for (let n = 0; n < doc.names.length; n++) {
        const name = doc.names[n] as string;
        const words = doc.nameWords[n] as string[];
        const localeBoost = localeNameIndex === n ? 1.15 : 1;
        if (words.some((w) => w === v)) best = Math.max(best, 70 * localeBoost);
        else if (words.some((w) => w.startsWith(v))) best = Math.max(best, 60 * localeBoost);
        else if (name.includes(v)) best = Math.max(best, 30 * localeBoost);
      }
      if (doc.brand === v || doc.brand.startsWith(v)) best = Math.max(best, 40);
      if (doc.tags.some((t) => t === v || t.startsWith(v))) best = Math.max(best, 25);
      if (doc.categories.some((c) => c.includes(v))) best = Math.max(best, 20);
      if (best < 8 && doc.summary.includes(v)) best = Math.max(best, 8);
      if (best < 2 && doc.description.includes(v)) best = Math.max(best, 2);
      if (best < 5 && v.length >= 3 && doc.codes.some((c) => c.includes(v))) best = Math.max(best, 5);
    }
    if (best === 0) {
      // the token may be a fragment of the whole code query (handled by `bonus`); otherwise this token fails the AND
      if (bonus === 0) return 0;
      continue;
    }
    total += best;
  }

  if (tokens.length > 1) {
    for (const name of doc.names) {
      if (name.includes(phrase)) {
        total += 300;
        break;
      }
    }
  }
  return total + bonus;
}

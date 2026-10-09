import "server-only";
import { db } from "@/lib/db";
import type { Locale } from "@/i18n/routing";
import { LOCALES } from "@/i18n/routing";
import type { Id, ProductSummary, VehicleSelection } from "@/lib/types/domain";
import type { ProductListResult, SearchQuery, SearchSuggestions } from "./contracts";
import { buildSearchDoc, isListable, loadCatalogContext, productIdsFitting, toSummary, type CatalogContext } from "./_catalog-data";
import { compact, fold, levenshtein, scoreDoc, tokenize } from "./_text";
import { listProducts } from "./catalog";
import { nowIso } from "./_shared";

/** Ranked, localized text search on top of the catalog read model. */

const MAX_QUERY = 120;

function cleanQuery(q: string): string {
  return q.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY);
}

/** Nearest known word for a misspelled token (edit distance <= 1 for short words, <= 2 for longer ones). */
function nearestWord(token: string, vocabulary: Set<string>): string | null {
  if (token.length < 3 || vocabulary.has(token)) return null;
  const max = token.length >= 6 ? 2 : 1;
  let best: string | null = null;
  let bestDistance = max + 1;
  const rank = (word: string, d: number) => d * 100 + Math.abs(word.length - token.length) * 10; // closer, then same length
  for (const word of vocabulary) {
    if (Math.abs(word.length - token.length) > max) continue;
    const d = levenshtein(token, word, max);
    if (d > max) continue;
    if (best === null || rank(word, d) < rank(best, bestDistance) || (rank(word, d) === rank(best, bestDistance) && word < best)) {
      best = word;
      bestDistance = d;
    }
  }
  return bestDistance <= max ? best : null;
}

function vocabularyOf(ctx: CatalogContext): Set<string> {
  const words = new Set<string>();
  for (const p of ctx.products) {
    if (!isListable(ctx, p)) continue;
    const doc = buildSearchDoc(ctx, p);
    for (const list of doc.nameWords) for (const w of list) if (w.length >= 3) words.add(w);
    for (const t of doc.tags) if (t.length >= 3) words.add(t);
    for (const w of doc.brand.split(" ")) if (w.length >= 3) words.add(w);
    for (const c of doc.categories) for (const w of c.split(" ")) if (w.length >= 3) words.add(w);
  }
  return words;
}

export async function searchProducts(query: SearchQuery): Promise<ProductListResult & { didYouMean?: string }> {
  const q = cleanQuery(query.q ?? "");
  const result = await listProducts({ ...query, q });
  if (result.total > 0 || !q) return result;

  const ctx = await loadCatalogContext();
  const vocabulary = vocabularyOf(ctx);
  const tokens = tokenize(q);
  let changed = false;
  const corrected = tokens.map((t) => {
    const near = nearestWord(t, vocabulary);
    if (near) {
      changed = true;
      return near;
    }
    return t;
  });
  if (!changed) return result;
  const suggestion = corrected.join(" ");
  const retry = await listProducts({ ...query, q: suggestion, page: 1, pageSize: 1 });
  return retry.total > 0 ? { ...result, didYouMean: suggestion } : result;
}

export async function suggest(
  q: string,
  opts: { locale?: Locale; vehicle?: VehicleSelection; limit?: number } = {},
): Promise<SearchSuggestions> {
  const query = cleanQuery(q);
  const empty: SearchSuggestions = { query, products: [], categories: [], brands: [] };
  const tokens = tokenize(query);
  if (query.length < 2 || tokens.length === 0) return empty;

  const ctx = await loadCatalogContext();
  const fits = await productIdsFitting(opts.vehicle);
  const nameIndex = opts.locale ? LOCALES.indexOf(opts.locale) : undefined;
  const limit = Math.min(8, Math.max(1, opts.limit ?? 8));

  const scored: { product: (typeof ctx.products)[number]; score: number }[] = [];
  for (const p of ctx.products) {
    if (!isListable(ctx, p)) continue;
    const score = scoreDoc(buildSearchDoc(ctx, p), query, tokens, nameIndex);
    if (score <= 0) continue;
    const vehicleBoost = fits && (p.fitment === "universal" || fits.has(p.id)) ? 25 : 0;
    scored.push({ product: p, score: score + vehicleBoost + Math.min(10, p.soldCount / 50) });
  }
  scored.sort((a, b) => b.score - a.score || a.product.name.en.localeCompare(b.product.name.en));

  const products: SearchSuggestions["products"] = scored.slice(0, limit).map(({ product }) => {
    const s: ProductSummary = toSummary(ctx, product, fits);
    return { id: s.id, slug: s.slug, name: s.name, ...(s.image ? { image: s.image } : {}), priceFrom: s.priceFrom, partNumber: s.partNumber, brand: s.brand };
  });

  const folded = tokens.map((t) => t);
  const matchesName = (...names: string[]) => folded.every((t) => names.some((n) => fold(n).includes(t)));
  const categories = [...ctx.categories.values()]
    .filter((c) => c.isActive && matchesName(c.name.en, c.name.tr))
    .sort((a, b) => Number(a.parentId !== null) - Number(b.parentId !== null) || a.name.en.length - b.name.en.length)
    .slice(0, 4)
    .map((c) => ({ id: c.id, slug: c.slug, name: c.name }));
  const brands = [...ctx.brands.values()]
    .filter((b) => b.isActive && matchesName(b.name))
    .sort((a, b) => a.name.length - b.name.length)
    .slice(0, 4)
    .map((b) => ({ id: b.id, slug: b.slug, name: b.name }));

  let exactMatch: SearchSuggestions["exactMatch"];
  const code = compact(query);
  if (code.length >= 3) {
    for (const p of ctx.products) {
      if (!isListable(ctx, p)) continue;
      if (compact(p.partNumber) === code) {
        exactMatch = { slug: p.slug, matchedOn: "partNumber" };
        break;
      }
      if ((ctx.variantsByProduct.get(p.id) ?? []).some((v) => compact(v.sku) === code)) {
        exactMatch = { slug: p.slug, matchedOn: "sku" };
        break;
      }
      if (p.oemNumbers.some((o) => compact(o) === code)) {
        exactMatch = { slug: p.slug, matchedOn: "oem" };
        break;
      }
    }
  }
  return { query, products, categories, brands, ...(exactMatch ? { exactMatch } : {}) };
}

const DEFAULT_POPULAR: Record<Locale, string[]> = {
  en: ["brake pads", "oil filter", "spark plugs", "headlight bulb", "wiper blades", "battery", "shock absorber", "coolant"],
  tr: ["fren balatası", "yağ filtresi", "buji", "far ampulü", "silecek", "akü", "amortisör", "antifriz"],
};

export async function getPopularSearches(locale: Locale): Promise<string[]> {
  const since = Date.now() - 90 * 24 * 3_600_000;
  const rows = await db.searchLog.find({ where: (r) => r.resultCount > 0 && Date.parse(r.at) >= since });
  const counts = new Map<string, { q: string; n: number }>();
  for (const r of rows) {
    const key = fold(r.q);
    if (key.length < 2) continue;
    const entry = counts.get(key);
    if (entry) entry.n++;
    else counts.set(key, { q: r.q.trim(), n: 1 });
  }
  const popular = [...counts.values()].sort((a, b) => b.n - a.n || a.q.localeCompare(b.q)).slice(0, 8).map((e) => e.q);
  const defaults = DEFAULT_POPULAR[locale] ?? DEFAULT_POPULAR.en;
  return popular.length >= 4 ? popular : [...new Set([...popular, ...defaults])].slice(0, 8);
}

const LOG_LIMIT = 4000;

export async function recordSearch(q: string, resultCount: number): Promise<void> {
  const query = cleanQuery(q).toLowerCase();
  if (query.length < 2) return;
  await db.transaction(async () => {
    await db.searchLog.insert({ q: query, resultCount: Math.max(0, Math.floor(resultCount)), at: nowIso() });
    const total = await db.searchLog.count();
    if (total > LOG_LIMIT) {
      const oldest = await db.searchLog.find({ orderBy: [{ field: "at", direction: "asc" }], limit: total - (LOG_LIMIT - 500) });
      const doomed = new Set<Id>(oldest.map((r) => r.id));
      await db.searchLog.deleteWhere((r) => doomed.has(r.id));
    }
  });
}

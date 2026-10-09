/**
 * Which specification rows are drawn as numbered dimensions on the product art (bubbles 1, 2, 3).
 * Shared by the art generator (scripts/generate-product-art.ts) and the product page spec sheet so the numbers match.
 * Pure: no server-only imports.
 */
export interface DimensionedSpec {
  key: { en: string };
  value: { en: string };
}

const LINEAR = /^\s*[ØøO]?\s*\d+(?:[.,]\d+)?(?:\s*[x×]\s*\d+(?:[.,]\d+)?)*\s*(?:mm\b|cm\b|in\b|")/i;

/** Indices into `specs` for up to three linear dimensions, in specification order. */
export function pickDimensionSpecs(specs: readonly DimensionedSpec[]): number[] {
  const out: number[] = [];
  specs.forEach((spec, i) => {
    if (out.length < 3 && LINEAR.test(spec.value.en)) out.push(i);
  });
  return out;
}

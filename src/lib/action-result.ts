import type { z } from "zod";
import { isDomainError } from "./errors";

/**
 * Return type of EVERY Server Action (see ARCHITECTURE.md > Server Actions).
 *  - `error` is a code translated by the UI via `errors.<code>` (falls back to `errors.unknown`).
 *  - `fieldErrors` maps form field paths ("shipping.postalCode") to validation codes translated
 *    via `validation.<code>`.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; errorParams?: Record<string, string | number>; fieldErrors?: Record<string, string[]> };

export type FieldErrors = Record<string, string[]>;

export function ok(): ActionResult<void>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(
  error: string,
  extra: { errorParams?: Record<string, string | number>; fieldErrors?: FieldErrors } = {},
): ActionResult<never> {
  return { ok: false, error, ...extra };
}

const CODE = /^[a-z][a-z0-9_]*$/;

/**
 * Validation code for one zod issue. Schemas in this codebase set code messages ("required", "too_long" ...) and
 * those pass through; issues raised by zod's own defaults (missing keys, wrong types ...) are mapped to the closest
 * code so UIs never receive English sentences.
 */
function issueCode(issue: z.core.$ZodIssue): string {
  if (CODE.test(issue.message)) return issue.message;
  switch (issue.code) {
    case "invalid_type":
      return issue.input === undefined ? "required" : "invalid_value";
    case "too_small":
      return issue.origin === "string" || issue.origin === "array" ? "required" : "must_not_be_negative";
    case "too_big":
      return issue.origin === "string" || issue.origin === "array" ? "too_long" : "too_large";
    default:
      return "invalid_value";
  }
}

/** Flatten a zod error into { "a.b.c": ["code", ...] }. Issue messages are validation codes. */
export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const path = issue.path.map(String).join(".") || "_form";
    (out[path] ??= []).push(issueCode(issue));
  }
  return out;
}

function isNextControlFlow(e: unknown): boolean {
  return !!e && typeof e === "object" && "digest" in e && typeof (e as { digest: unknown }).digest === "string";
}

/**
 * Standard Server Action wrapper: validates input with zod, runs the handler, and converts
 * thrown DomainErrors / unexpected errors into the ActionResult contract.
 *
 *   export async function addToCart(raw: unknown) {
 *     return runAction(addToCartSchema, raw, async (input) => { ...; return data; });
 *   }
 *
 * `redirect()` / `notFound()` thrown inside the handler propagate (Next control flow).
 */
export async function runAction<S extends z.ZodType, T>(
  schema: S,
  raw: unknown,
  handler: (input: z.output<S>) => Promise<T>,
): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", { fieldErrors: zodFieldErrors(parsed.error) });
  try {
    return { ok: true, data: await handler(parsed.data) };
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    if (isDomainError(e)) return fail(e.code, { errorParams: e.params, fieldErrors: e.fieldErrors });
    console.error("[action] unexpected error", e);
    return fail("unknown");
  }
}

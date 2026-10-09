import "server-only";
import type { z } from "zod";
import { zodFieldErrors } from "@/lib/action-result";
import { isDomainError, DomainError } from "@/lib/errors";
import { siteUrl } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Route handler helpers (ARCHITECTURE.md > API). Handlers stay thin:
 *   parse + validate -> authorise -> call a service -> `json()` ; any thrown error goes through `problem()`.
 * Error body shape: { error: code, errorParams?, fieldErrors? } with the HTTP status of the DomainError.
 */

const NO_STORE = "private, no-store";

export interface JsonInit extends ResponseInit {
  /** Cache-Control override; default is `private, no-store`. Only use `public` for cookie-independent data. */
  cacheControl?: string;
}

export function json<T>(data: T, init: JsonInit = {}): Response {
  const { cacheControl, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("Cache-Control", cacheControl ?? NO_STORE);
  headers.set("X-Content-Type-Options", "nosniff");
  return Response.json(data, { ...rest, headers });
}

/** Turns anything thrown by a handler into the standard error response. */
export function problem(error: unknown): Response {
  if (isDomainError(error)) {
    const headers: Record<string, string> = {};
    const retry = error.params?.retryAfter;
    if (error.status === 429 && typeof retry === "number") headers["Retry-After"] = String(retry);
    return json(
      { error: error.code, ...(error.params ? { errorParams: error.params } : {}), ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}) },
      { status: error.status, headers },
    );
  }
  logger.error("api.unexpected", { error });
  return json({ error: "unknown" }, { status: 500 });
}

/** Wraps a handler so thrown errors become `problem()` responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (error) {
      return problem(error);
    }
  };
}

export function validate<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new DomainError("validation_failed", { status: 400, fieldErrors: zodFieldErrors(parsed.error) });
  return parsed.data;
}

/** Reads a JSON body with a hard size cap, then validates it. */
export async function readJson<S extends z.ZodType>(request: Request, schema: S, opts: { maxBytes?: number } = {}): Promise<z.output<S>> {
  const max = opts.maxBytes ?? 64 * 1024;
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/json")) throw new DomainError("validation_failed", { status: 415 });
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > max) throw new DomainError("file_too_large", { status: 413 });
  const text = await request.text();
  if (text.length > max) throw new DomainError("file_too_large", { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new DomainError("validation_failed", { status: 400 });
  }
  return validate(schema, body);
}

/** Like readJson, but an empty body is treated as `{}` (DELETE requests that may or may not carry a body). */
export async function readOptionalJson<S extends z.ZodType>(request: Request, schema: S, opts: { maxBytes?: number } = {}): Promise<z.output<S>> {
  const max = opts.maxBytes ?? 64 * 1024;
  const text = await request.text();
  if (text.length > max) throw new DomainError("file_too_large", { status: 413 });
  if (text.trim() === "") return validate(schema, {});
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new DomainError("validation_failed", { status: 400 });
  }
  return validate(schema, body);
}

/** Query string -> plain object of strings (first value wins). */
export function searchParamsObject(url: URL): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of url.searchParams) if (!(k in out)) out[k] = v;
  return out;
}

/**
 * CSRF guard for cookie-authenticated mutations: browsers always send `Origin` on cross-site writes, so a present
 * Origin must be ours. (Requests without Origin are non-browser clients, which carry no ambient cookies to abuse.)
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const allowed = new Set([new URL(request.url).origin, new URL(siteUrl()).origin]);
  if (!allowed.has(origin)) throw new DomainError("forbidden", { status: 403 });
}

export function csvResponse(csv: string, filename: string): Response {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safe}"`,
      "Cache-Control": NO_STORE,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

import "server-only";
import { env } from "@/lib/env";

/**
 * Structured logger. JSON lines in production, readable single lines in development.
 * Never pass PII, passwords, card data or tokens; known sensitive keys are redacted defensively anyway.
 */
type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const REDACT = /pass(word)?|secret|token|authorization|cookie|card|cvc|cvv|number|signature/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Error) return { name: value.name, message: value.message, ...(env.NODE_ENV === "production" ? {} : { stack: value.stack }) };
  if (typeof value !== "object") return value;
  if (depth > 3) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitize(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = REDACT.test(k) ? "[redacted]" : sanitize(v, depth + 1);
  return out;
}

function enabled(level: Level): boolean {
  if (env.NODE_ENV === "test" && level !== "error") return process.env.LOG_LEVEL === "debug";
  return ORDER[level] >= ORDER[env.LOG_LEVEL];
}

function write(level: Level, event: string, fields?: Record<string, unknown>) {
  if (!enabled(level)) return;
  const safe = fields ? (sanitize(fields) as Record<string, unknown>) : undefined;
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (env.NODE_ENV === "production") {
    sink(JSON.stringify({ time: new Date().toISOString(), level, event, ...safe }));
  } else {
    sink(`[${level}] ${event}${safe && Object.keys(safe).length ? " " + JSON.stringify(safe) : ""}`);
  }
}

export const logger = {
  debug: (event: string, fields?: Record<string, unknown>) => write("debug", event, fields),
  info: (event: string, fields?: Record<string, unknown>) => write("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => write("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => write("error", event, fields),
};

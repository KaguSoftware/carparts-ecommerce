import { LOCALES } from "@/i18n/routing";

/**
 * Sanitises a post-login `next` target. Accepts only same-site absolute paths, strips a leading locale segment
 * (the proxy puts the full `/en/account/orders` in `?next=`, while the i18n router wants the unprefixed path) and
 * refuses protocol-relative URLs, backslashes, control characters and anything pointing at /api or /admin.
 * Pure: safe to import from client components and server actions alike.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || typeof next !== "string") return null;
  let value = next.trim();
  if (value.length === 0 || value.length > 300) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;

  const segments = value.split("/");
  const first = segments[1] ?? "";
  if ((LOCALES as readonly string[]).includes(first)) {
    value = "/" + segments.slice(2).join("/");
    if (value === "/") return "/";
  }
  if (/^\/(api|admin|_next)(\/|$|\?)/.test(value)) return null;
  return value;
}

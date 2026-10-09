import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { createToken } from "@/lib/db/id";
import { env } from "@/lib/env";
import { DomainError } from "@/lib/errors";

/**
 * Admin image uploads. Files are validated by CONTENT (magic bytes), never by the client-declared type or file name,
 * renamed to a random name, stored in UPLOAD_DIR (default public/uploads) and served by /uploads/[...path] with a
 * sandboxing CSP. SVGs are accepted only when they contain no active content.
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type ImageType = "image/png" | "image/jpeg" | "image/webp" | "image/avif" | "image/svg+xml";

const EXTENSION: Record<ImageType, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/avif": "avif", "image/svg+xml": "svg" };
const CONTENT_TYPE: Record<string, ImageType> = Object.fromEntries(Object.entries(EXTENSION).map(([type, ext]) => [ext, type as ImageType]));
CONTENT_TYPE.jpeg = "image/jpeg";

export function uploadDir(): string {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), env.UPLOAD_DIR);
}

const ascii = (bytes: Uint8Array, start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));

/** Detects the real format from the first bytes. Returns null for anything that is not an allowed image. */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x89 && ascii(bytes, 1, 4) === "PNG") return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";
  if (ascii(bytes, 4, 8) === "ftyp" && /^(avif|avis)$/.test(ascii(bytes, 8, 12))) return "image/avif";
  const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 512)).replace(/^﻿/, "").trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "image/svg+xml";
  return null;
}

const SVG_FORBIDDEN: RegExp[] = [
  /<\s*script/i,
  /<\s*foreignobject/i,
  /<\s*(iframe|embed|object|audio|video|canvas|link|meta|style\s+[^>]*@import)/i,
  /\son[a-z]+\s*=/i, // onload=, onclick= ...
  /javascript\s*:/i,
  /data\s*:\s*text\/html/i,
  /<!entity/i,
  /<!doctype[^>]*\[/i, // internal DTD subset (XXE / billion laughs)
  /(xlink:)?href\s*=\s*["']\s*(?!#)[a-z][a-z0-9+.-]*:/i, // any href to another scheme (http:, data:, file: ...)
];

/** True when the SVG text contains nothing executable or external. */
export function isSafeSvg(text: string): boolean {
  return !SVG_FORBIDDEN.some((pattern) => pattern.test(text));
}

export interface SavedUpload {
  url: string;
  name: string;
  size: number;
  type: ImageType;
}

export async function saveImageUpload(bytes: Uint8Array): Promise<SavedUpload> {
  if (bytes.byteLength === 0) throw new DomainError("file_type_not_allowed", { status: 415 });
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new DomainError("file_too_large", { status: 413 });
  const type = detectImageType(bytes);
  if (!type) throw new DomainError("file_type_not_allowed", { status: 415 });
  if (type === "image/svg+xml" && !isSafeSvg(new TextDecoder().decode(bytes))) throw new DomainError("file_type_not_allowed", { status: 415 });

  const name = `${createToken(12)}.${EXTENSION[type]}`;
  await fs.mkdir(/* turbopackIgnore: true */ uploadDir(), { recursive: true });
  const target = path.join(/* turbopackIgnore: true */ uploadDir(), name);
  await fs.writeFile(`${target}.tmp`, bytes, { flag: "wx" });
  await fs.rename(`${target}.tmp`, target);
  return { url: `/uploads/${name}`, name, size: bytes.byteLength, type };
}

const SAFE_NAME = /^[A-Za-z0-9_-]{8,64}\.(png|jpg|jpeg|webp|avif|svg)$/;

/** Reads an uploaded file by its public name. Returns null for anything that is not a plain file name we wrote. */
export async function readUpload(name: string): Promise<{ bytes: Buffer; type: ImageType } | null> {
  if (!SAFE_NAME.test(name)) return null; // blocks "..", slashes, absolute paths and odd extensions
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  const type = CONTENT_TYPE[ext];
  if (!type) return null;
  try {
    return { bytes: await fs.readFile(path.join(/* turbopackIgnore: true */ uploadDir(), name)), type };
  } catch {
    return null;
  }
}

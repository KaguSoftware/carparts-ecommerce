import { readUpload } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/**
 * Serves admin uploads from UPLOAD_DIR. Next only serves files that existed in /public at build time, so uploads
 * made while the server runs are streamed from here. Only plain file names we generated are served; the response is
 * locked down (nosniff + sandboxing CSP) because the content is user controlled.
 */
export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await context.params;
  if (segments.length !== 1) return new Response("Not found", { status: 404 });
  const file = await readUpload(segments[0] as string);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.type,
      "Content-Length": String(file.bytes.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}

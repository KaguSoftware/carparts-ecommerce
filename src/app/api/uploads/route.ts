import { assertStaff } from "@/lib/auth/session";
import { toActor } from "@/lib/auth/session";
import { assertSameOrigin, handle, json } from "@/lib/api/respond";
import { DomainError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { logAudit } from "@/lib/services/audit";
import { MAX_UPLOAD_BYTES, saveImageUpload } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/**
 * POST multipart/form-data { file } (staff only) -> { url, name, size, type }.
 * Images only (PNG, JPEG, WebP, AVIF, script-free SVG), at most 5 MB, validated by content, stored under a random name.
 */
export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  const staff = await assertStaff("catalog.write");
  await enforceRateLimit("upload", { limit: 60, windowMs: 10 * 60_000, discriminator: staff.id });

  const declared = Number(request.headers.get("content-length") ?? 0);
  // multipart framing adds a little overhead on top of the file itself
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) throw new DomainError("file_too_large", { status: 413 });
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("multipart/form-data")) throw new DomainError("file_type_not_allowed", { status: 415 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new DomainError("file_type_not_allowed", { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new DomainError("validation_failed", { status: 400, fieldErrors: { file: ["required"] } });
  if (file.size > MAX_UPLOAD_BYTES) throw new DomainError("file_too_large", { status: 413 });

  const saved = await saveImageUpload(new Uint8Array(await file.arrayBuffer()));
  await logAudit({ actor: toActor(staff), action: "upload.create", entityType: "upload", entityId: saved.name, summary: `Uploaded ${saved.type} (${saved.size} bytes)` });
  return json(saved, { status: 201 });
});

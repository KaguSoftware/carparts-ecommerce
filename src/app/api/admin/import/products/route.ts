import { assertStaff, toActor } from "@/lib/auth/session";
import { assertSameOrigin, handle, json, searchParamsObject } from "@/lib/api/respond";
import { DomainError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { importProductsCsv } from "@/lib/services/catalog";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * POST /api/admin/import/products[?dryRun=1] with either `text/csv` as the body or multipart/form-data { file }.
 * Staff with catalog.write only. Returns { created, updated, skipped, errors[] }; dryRun validates and rolls back.
 */
export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  const staff = await assertStaff("catalog.write");
  await enforceRateLimit("import", { limit: 10, windowMs: 10 * 60_000, discriminator: staff.id });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES + 64 * 1024) throw new DomainError("file_too_large", { status: 413 });

  const type = (request.headers.get("content-type") ?? "").toLowerCase();
  let csv: string;
  if (type.startsWith("multipart/form-data")) {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) throw new DomainError("csv_invalid", { status: 400 });
    if (file.size > MAX_BYTES) throw new DomainError("file_too_large", { status: 413 });
    csv = await file.text();
  } else if (type.startsWith("text/csv") || type.startsWith("text/plain") || type.startsWith("application/csv")) {
    csv = await request.text();
  } else {
    throw new DomainError("csv_invalid", { status: 415 });
  }
  const dryRun = ["1", "true"].includes(searchParamsObject(new URL(request.url)).dryRun ?? "");
  return json(await importProductsCsv(csv, toActor(staff), { dryRun }));
});

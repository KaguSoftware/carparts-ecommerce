import "server-only";
import type { z } from "zod";
import { fail, runAction, type ActionResult } from "@/lib/action-result";
import { assertStaff, toActor } from "@/lib/auth/session";
import { DomainError, isDomainError } from "@/lib/errors";
import type { Actor, Permission, SessionUser } from "@/lib/types/domain";
import { revalidateAdmin, revalidateStore } from "@/lib/cache";

export interface AdminContext {
  user: SessionUser;
  actor: Actor;
}

/**
 * Wrapper for EVERY admin Server Action: authorise first (`assertStaff(permission)`), then validate the raw input
 * with the zod schema, run the handler with the audit `Actor`, and map failures to the ActionResult contract.
 * Services still enforce their own invariants; this layer decides WHO may call them.
 */
export async function adminAction<S extends z.ZodType, T>(
  permission: Permission,
  schema: S,
  raw: unknown,
  handler: (input: z.output<S>, ctx: AdminContext) => Promise<T>,
): Promise<ActionResult<T>> {
  let user: SessionUser;
  try {
    user = await assertStaff(permission);
  } catch (error) {
    if (isDomainError(error)) return fail(error.code);
    throw error;
  }
  return runAction(schema, raw, (input) => handler(input, { user, actor: toActor(user) }));
}

/**
 * Re-throws a service failure with its field error paths nested under `prefix` ("name.en" -> "product.name.en"),
 * so errors from a service call land on the right input of a composite form.
 */
export function prefixFieldErrors(error: unknown, prefix: string): never {
  if (isDomainError(error) && error.fieldErrors) {
    const fieldErrors = Object.fromEntries(Object.entries(error.fieldErrors).map(([path, codes]) => [`${prefix}.${path}`, codes]));
    throw new DomainError(error.code, { status: error.status, params: error.params, fieldErrors });
  }
  throw error;
}

/** Refresh the admin pages that list `path` and (when catalog/content changed) the storefront. */
export function refresh(paths: string[] = [], opts: { store?: boolean } = {}): void {
  if (paths.length === 0) revalidateAdmin();
  for (const path of paths) revalidateAdmin(path);
  if (opts.store) revalidateStore();
}

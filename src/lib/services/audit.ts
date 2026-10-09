import "server-only";
import { db } from "@/lib/db";
import type { AuditEntry, Paged } from "@/lib/types/domain";
import type { AuditFilter } from "./contracts";
import { nowIso, paginate } from "./_shared";

/**
 * Append-only audit log. Every admin write calls `logAudit` (inside the same transaction as the write,
 * so the entry exists if and only if the change committed).
 */

const MAX_SUMMARY = 300;

export async function logAudit(entry: Omit<AuditEntry, "id" | "at">): Promise<AuditEntry> {
  return db.auditLog.insert({
    at: nowIso(),
    actor: entry.actor,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    summary: entry.summary.slice(0, MAX_SUMMARY),
    ...(entry.changes && Object.keys(entry.changes).length ? { changes: entry.changes } : {}),
  });
}

export async function listAudit(filter: AuditFilter): Promise<Paged<AuditEntry>> {
  const q = filter.q?.trim().toLowerCase();
  const action = filter.action?.trim();
  const from = filter.from ? Date.parse(filter.from) : undefined;
  const to = filter.to ? Date.parse(filter.to) : undefined;

  const rows = await db.auditLog.find({
    where: (e) => {
      if (action) {
        // "product." or "product.*" matches a family, otherwise exact
        const prefix = action.endsWith(".*") ? action.slice(0, -1) : action.endsWith(".") ? action : null;
        if (prefix ? !e.action.startsWith(prefix) : e.action !== action) return false;
      }
      if (filter.entityType && e.entityType !== filter.entityType) return false;
      if (filter.entityId && e.entityId !== filter.entityId) return false;
      if (filter.actorId && e.actor.id !== filter.actorId) return false;
      if (from !== undefined || to !== undefined) {
        const t = Date.parse(e.at);
        if (from !== undefined && t < from) return false;
        if (to !== undefined && t > to) return false;
      }
      if (q) {
        const hay = `${e.summary} ${e.action} ${e.entityType} ${e.entityId} ${e.actor.email ?? ""} ${e.actor.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    },
    orderBy: [{ field: "at", direction: "desc" }],
  });
  return paginate(rows, filter, 50);
}

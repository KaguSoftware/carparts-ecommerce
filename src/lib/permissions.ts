import type { Permission, UserRole } from "@/lib/types/domain";

/**
 * Role -> permission matrix (ARCHITECTURE.md > Auth). Pure, so server code, admin UI and tests share it
 * (the UI only uses it to hide links; the real enforcement is `requireStaff` / `assertStaff` on the server).
 *
 *                                         staff  admin
 *   dashboard/catalog/orders/customers.read  yes    yes
 *   catalog/inventory/orders.write, reviews.moderate, marketing.write, cms.write   yes   yes
 *   orders.refund, settings.write, users.manage, audit.read   no   yes
 */
const STAFF_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  "dashboard.read",
  "catalog.read",
  "orders.read",
  "customers.read",
  "catalog.write",
  "inventory.write",
  "orders.write",
  "reviews.moderate",
  "marketing.write",
  "cms.write",
]);

const ADMIN_ONLY: ReadonlySet<Permission> = new Set<Permission>(["orders.refund", "settings.write", "users.manage", "audit.read"]);

export function can(role: UserRole, permission: Permission): boolean {
  if (role === "admin") return STAFF_PERMISSIONS.has(permission) || ADMIN_ONLY.has(permission);
  if (role === "staff") return STAFF_PERMISSIONS.has(permission);
  return false;
}

export function permissionsFor(role: UserRole): Permission[] {
  return [...STAFF_PERMISSIONS, ...ADMIN_ONLY].filter((p) => can(role, p));
}

import "server-only";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { zodFieldErrors } from "@/lib/action-result";
import { createToken, db } from "@/lib/db";
import { createPasswordSetupUrl } from "@/lib/auth/password-links";
import { sendPasswordReset as sendPasswordResetEmail, sendStaffInvite } from "@/lib/email";
import { DomainError, notFound } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { Actor, Address, Id, Order, Paged, User, UserRole } from "@/lib/types/domain";
import { emailSchema } from "@/lib/validation/common";
import type { UserFilter, UserRow } from "./contracts";
import { netSpent, purgeUser } from "./accounts";
import { logAudit } from "./audit";
import { includesText, nowIso, paginate } from "./_shared";

const createSchema = z.object({
  name: z.string().trim().min(1, "required").max(80, "too_long"),
  email: emailSchema,
  role: z.enum(["staff", "admin"]),
});

async function activeAdminCount(exceptId?: Id): Promise<number> {
  return db.users.count((u) => u.role === "admin" && !u.disabled && u.id !== exceptId);
}

export async function listUsers(filter: UserFilter): Promise<Paged<UserRow>> {
  const [users, orders] = await Promise.all([db.users.all(), db.orders.all()]);
  const stats = new Map<Id, { orderCount: number; totalSpent: number; lastOrderAt?: string }>();
  for (const o of orders) {
    if (!o.userId) continue;
    const s = stats.get(o.userId) ?? { orderCount: 0, totalSpent: 0 };
    if (!(o.status === "pending_payment" && o.paymentStatus === "failed")) s.orderCount++;
    s.totalSpent += netSpent(o);
    if (!s.lastOrderAt || o.createdAt > s.lastOrderAt) s.lastOrderAt = o.createdAt;
    stats.set(o.userId, s);
  }
  const rows: UserRow[] = users
    .filter((u) => {
      if (filter.role && filter.role !== "all") {
        if (filter.role === "staff_and_admin" ? u.role === "customer" : u.role !== filter.role) return false;
      }
      if (filter.status === "active" && u.disabled) return false;
      if (filter.status === "disabled" && !u.disabled) return false;
      return filter.q ? includesText([u.name, u.email, u.phone], filter.q) : true;
    })
    .map((user) => {
      const s = stats.get(user.id);
      return { user, orderCount: s?.orderCount ?? 0, totalSpent: s?.totalSpent ?? 0, ...(s?.lastOrderAt ? { lastOrderAt: s.lastOrderAt } : {}) };
    });
  switch (filter.sort ?? "created_desc") {
    case "name_asc":
      rows.sort((a, b) => a.user.name.localeCompare(b.user.name));
      break;
    case "spent_desc":
      rows.sort((a, b) => b.totalSpent - a.totalSpent);
      break;
    case "orders_desc":
      rows.sort((a, b) => b.orderCount - a.orderCount);
      break;
    default:
      rows.sort((a, b) => b.user.createdAt.localeCompare(a.user.createdAt));
  }
  return paginate(rows, filter, 25);
}

export async function getUserDetail(id: Id): Promise<{ user: User; addresses: Address[]; orders: Order[]; totalSpent: number; reviewsCount: number } | null> {
  const user = await db.users.get(id);
  if (!user) return null;
  const [addresses, orders, reviewsCount] = await Promise.all([
    db.addresses.find({ where: (a) => a.userId === id }),
    db.orders.find({ where: (o) => o.userId === id, orderBy: [{ field: "createdAt", direction: "desc" }] }),
    db.reviews.count((r) => r.userId === id),
  ]);
  return { user, addresses, orders, totalSpent: orders.reduce((s, o) => s + netSpent(o), 0), reviewsCount };
}

export async function createStaffUser(input: { name: string; email: string; role: Exclude<UserRole, "customer"> }, actor: Actor): Promise<User> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("validation_failed", { fieldErrors: zodFieldErrors(parsed.error) });
  const data = parsed.data;
  const passwordHash = await hashPassword(createToken(32)); // unusable until the invite link sets a real password
  const user = await db.transaction(async () => {
    if (await db.users.findOne((u) => u.email.toLowerCase() === data.email)) throw new DomainError("email_taken", { status: 409 });
    const at = nowIso();
    const created = await db.users.insert({
      email: data.email,
      emailVerified: true,
      name: data.name,
      image: null,
      role: data.role,
      phone: null,
      locale: "en",
      disabled: false,
      marketingOptIn: false,
      lastLoginAt: null,
      createdAt: at,
      updatedAt: at,
    });
    await db.authAccounts.insert({ userId: created.id, providerId: "credential", accountId: created.id, password: passwordHash, createdAt: at, updatedAt: at });
    await logAudit({ actor, action: "user.create", entityType: "user", entityId: created.id, summary: `Created ${data.role} account for ${data.email}`, changes: { role: { from: null, to: data.role } } });
    return created;
  });
  try {
    await sendStaffInvite({ email: user.email, name: user.name, url: await createPasswordSetupUrl(user.id, { locale: user.locale }), locale: user.locale });
  } catch (error) {
    logger.warn("users.invite_failed", { userId: user.id, error });
  }
  return user;
}

export async function setUserRole(id: Id, role: UserRole, actor: Actor): Promise<User> {
  if (!["customer", "staff", "admin"].includes(role)) throw new DomainError("validation_failed", { fieldErrors: { role: ["invalid_value"] } });
  if (actor.id === id) throw new DomainError("cannot_modify_self", { status: 403 });
  return db.transaction(async () => {
    const user = await db.users.get(id);
    if (!user) throw notFound("user");
    if (user.role === role) return user;
    if (user.role === "admin" && role !== "admin" && (await activeAdminCount(id)) === 0) throw new DomainError("last_admin", { status: 409 });
    const saved = await db.users.update(id, { role, updatedAt: nowIso() });
    // a changed role must not ride on an old session
    await db.authSessions.deleteWhere((s) => s.userId === id);
    await logAudit({ actor, action: "user.role_change", entityType: "user", entityId: id, summary: `${user.email}: ${user.role} -> ${role}`, changes: { role: { from: user.role, to: role } } });
    return saved;
  });
}

export async function setUserDisabled(id: Id, disabled: boolean, actor: Actor): Promise<User> {
  if (actor.id === id) throw new DomainError("cannot_modify_self", { status: 403 });
  return db.transaction(async () => {
    const user = await db.users.get(id);
    if (!user) throw notFound("user");
    if (user.disabled === disabled) return user;
    if (disabled && user.role === "admin" && (await activeAdminCount(id)) === 0) throw new DomainError("last_admin", { status: 409 });
    const saved = await db.users.update(id, { disabled, updatedAt: nowIso() });
    if (disabled) await db.authSessions.deleteWhere((s) => s.userId === id);
    await logAudit({ actor, action: disabled ? "user.disable" : "user.enable", entityType: "user", entityId: id, summary: `${disabled ? "Disabled" : "Enabled"} ${user.email}`, changes: { disabled: { from: user.disabled, to: disabled } } });
    return saved;
  });
}

export async function sendPasswordReset(id: Id, actor: Actor): Promise<void> {
  const user = await db.users.get(id);
  if (!user) throw notFound("user");
  const url = await createPasswordSetupUrl(id, { locale: user.locale, ttlSeconds: 60 * 60 });
  await sendPasswordResetEmail({ email: user.email, name: user.name, url, locale: user.locale });
  await logAudit({ actor, action: "user.password_reset", entityType: "user", entityId: id, summary: `Sent a password reset email to ${user.email}` });
}

export async function deleteUser(id: Id, actor: Actor): Promise<void> {
  if (actor.id === id) throw new DomainError("cannot_modify_self", { status: 403 });
  const user = await db.users.get(id);
  if (!user) throw notFound("user");
  await purgeUser(id, actor);
}


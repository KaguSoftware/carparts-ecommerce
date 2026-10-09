import { ADMIN, freshSeed, STAFF } from "../helpers/test-env";
import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import { db } from "@/lib/db";
import { outboxDir } from "@/lib/email";
import * as accounts from "@/lib/services/accounts";
import * as usersAdmin from "@/lib/services/users-admin";

beforeAll(async () => {
  await freshSeed();
}, 60_000);

const ADDRESS = { firstName: "Ann", lastName: "Lee", line1: "1 Test Road", city: "Austin", region: "TX", postalCode: "78701", country: "US", phone: "+1 512 555 0100" };
const mail = () => (fs.existsSync(outboxDir()) ? fs.readdirSync(outboxDir()) : []).map((n) => JSON.parse(fs.readFileSync(`${outboxDir()}/${n}`, "utf8")) as { template: string; to: string; text: string });

describe("profile and lookups", () => {
  it("finds users by id and (case-insensitive) email and updates the profile", async () => {
    const byEmail = await accounts.getUserByEmail("  CUSTOMER@apexline.example ");
    expect(byEmail?.id).toBe("usr_customer");
    expect(await accounts.getUserById("usr_customer")).toMatchObject({ email: "customer@apexline.example" });
    expect(await accounts.getUserById("usr_missing")).toBeNull();

    const updated = await accounts.updateProfile("usr_customer", { name: "  Deniz K.  ", phone: "+1 313 555 0111", locale: "tr", marketingOptIn: false });
    expect(updated).toMatchObject({ name: "Deniz K.", phone: "+1 313 555 0111", locale: "tr", marketingOptIn: false });
    expect((await accounts.updateProfile("usr_customer", { name: "Deniz Kaya", phone: null, locale: "en", marketingOptIn: true })).phone).toBeNull();
    await expect(accounts.updateProfile("usr_customer", { name: "", locale: "en", marketingOptIn: true })).rejects.toMatchObject({ code: "validation_failed", fieldErrors: { name: ["required"] } });
    await expect(accounts.updateProfile("usr_customer", { name: "X", phone: "abc", locale: "en", marketingOptIn: true })).rejects.toMatchObject({ code: "validation_failed" });
    await expect(accounts.updateProfile("usr_missing", { name: "X", locale: "en", marketingOptIn: true })).rejects.toMatchObject({ code: "not_found" });
  });

  it("summarises orders, wishlist and spending without abandoned attempts", async () => {
    const summary = await accounts.getAccountSummary("usr_customer");
    expect(summary.orderCount).toBeGreaterThan(3);
    expect(summary.addressCount).toBeGreaterThan(0);
    expect(summary.lastOrder?.internalNotes).toEqual([]);
    const orders = await db.orders.find({ where: (o) => o.userId === "usr_customer" });
    const spent = orders.filter((o) => ["paid", "partially_refunded", "refunded"].includes(o.paymentStatus)).reduce((s, o) => s + o.total - o.refundedTotal, 0);
    expect(summary.totalSpent).toBe(spent);
  });
});

describe("address book", () => {
  it("makes the first address the default and moves defaults on request", async () => {
    const user = "usr_c08";
    await db.addresses.deleteWhere((a) => a.userId === user);
    const first = await accounts.createAddress(user, { ...ADDRESS, label: "Home" });
    expect(first).toMatchObject({ isDefaultShipping: true, isDefaultBilling: true, userId: user });
    const second = await accounts.createAddress(user, { ...ADDRESS, line1: "2 Work Street", label: "Work", isDefaultShipping: true });
    expect(second.isDefaultShipping).toBe(true);
    expect(second.isDefaultBilling).toBe(false);
    let list = await accounts.listAddresses(user);
    expect(list.filter((a) => a.isDefaultShipping).map((a) => a.id)).toEqual([second.id]);
    expect(list.filter((a) => a.isDefaultBilling).map((a) => a.id)).toEqual([first.id]);
    expect(list[0]!.id).toBe(second.id); // default shipping first

    const edited = await accounts.updateAddress(user, first.id, { city: "Dallas", isDefaultShipping: true });
    expect(edited.city).toBe("Dallas");
    list = await accounts.listAddresses(user);
    expect(list.filter((a) => a.isDefaultShipping).map((a) => a.id)).toEqual([first.id]);

    await accounts.deleteAddress(user, first.id); // it was both defaults: the survivor inherits them
    list = await accounts.listAddresses(user);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: second.id, isDefaultShipping: true, isDefaultBilling: true });
  });

  it("enforces ownership and validation", async () => {
    const mine = (await accounts.listAddresses("usr_customer"))[0]!;
    await expect(accounts.updateAddress("usr_c01", mine.id, { city: "Hacked" })).rejects.toMatchObject({ code: "not_found" });
    await expect(accounts.deleteAddress("usr_c01", mine.id)).rejects.toMatchObject({ code: "not_found" });
    expect((await db.addresses.get(mine.id))!.city).toBe(mine.city);
    await expect(accounts.createAddress("usr_customer", { ...ADDRESS, postalCode: "" })).rejects.toMatchObject({ code: "validation_failed" });
    await expect(accounts.createAddress("usr_customer", { ...ADDRESS, country: "USA" })).rejects.toMatchObject({ code: "validation_failed" });
    await expect(accounts.createAddress("usr_missing", ADDRESS)).rejects.toMatchObject({ code: "not_found" });
    const cleared = await accounts.updateAddress("usr_customer", mine.id, { company: "" });
    expect(cleared.company).toBeUndefined();
  });
});

describe("account deletion", () => {
  it("removes personal data, keeps an anonymised order history, and unlinks reviews", async () => {
    const userId = "usr_c09";
    const user = (await db.users.get(userId))!;
    const orderCount = await db.orders.count((o) => o.userId === userId);
    expect(orderCount).toBeGreaterThan(0);
    await db.authSessions.insert({ userId, token: "tok_x", expiresAt: new Date(Date.now() + 1e6).toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

    await accounts.deleteAccount(userId);
    expect(await db.users.get(userId)).toBeNull();
    expect(await db.addresses.count((a) => a.userId === userId)).toBe(0);
    expect(await db.authSessions.count((s) => s.userId === userId)).toBe(0);
    expect(await db.authAccounts.count((a) => a.userId === userId)).toBe(0);
    expect(await db.reviews.count((r) => r.userId === userId)).toBe(0);

    const kept = await db.orders.find({ where: (o) => o.email.startsWith("deleted-") && o.createdAt > "2000" });
    expect(kept.length).toBe(orderCount);
    for (const order of kept) {
      expect(order.userId).toBeNull();
      expect(order.email).not.toContain(user.email);
      expect(order.shippingAddress).toMatchObject({ firstName: "Deleted", line1: "Removed", phone: "" });
      expect(order.billingAddress.firstName).toBe("Deleted");
    }
    await expect(accounts.deleteAccount(userId)).rejects.toMatchObject({ code: "not_found" });
  });

  it("will not delete the last administrator", async () => {
    await expect(accounts.deleteAccount("usr_admin")).rejects.toMatchObject({ code: "last_admin" });
  });
});

describe("staff user administration", () => {
  it("lists, filters and sorts users with order statistics", async () => {
    const all = await usersAdmin.listUsers({ pageSize: 100 });
    expect(all.total).toBeGreaterThan(10);
    const staffAndAdmin = await usersAdmin.listUsers({ role: "staff_and_admin", pageSize: 100 });
    expect(staffAndAdmin.items.map((r) => r.user.role).sort()).toEqual(["admin", "staff"]);
    expect((await usersAdmin.listUsers({ role: "customer", status: "disabled" })).items.every((r) => r.user.disabled)).toBe(true);
    expect((await usersAdmin.listUsers({ q: "sofia" })).items[0]?.user.email).toBe("sofia.marino@mail.example");
    const bySpend = await usersAdmin.listUsers({ sort: "spent_desc", pageSize: 100 });
    const spent = bySpend.items.map((r) => r.totalSpent);
    expect(spent).toEqual([...spent].sort((a, b) => b - a));
    const customer = all.items.find((r) => r.user.id === "usr_customer")!;
    expect(customer.orderCount).toBeGreaterThan(0);
    expect(customer.lastOrderAt).toBeTruthy();
    const detail = (await usersAdmin.getUserDetail("usr_customer"))!;
    expect(detail.orders.length).toBeGreaterThan(0);
    expect(detail.addresses.length).toBeGreaterThan(0);
    expect(await usersAdmin.getUserDetail("usr_missing")).toBeNull();
  });

  it("creates a staff account with an unusable password and emails an invitation link", async () => {
    const before = mail().length;
    const created = await usersAdmin.createStaffUser({ name: "New Hire", email: "New.Hire@Example.com", role: "staff" }, ADMIN);
    expect(created).toMatchObject({ email: "new.hire@example.com", role: "staff", disabled: false, emailVerified: true });
    const invite = mail().slice(before).find((m) => m.template === "staff_invite")!;
    expect(invite.to).toBe("new.hire@example.com");
    const token = /reset-password\/([A-Za-z0-9_-]+)\?/.exec(invite.text)?.[1];
    expect(token).toBeTruthy();
    const verification = (await db.authVerifications.findOne((v) => v.identifier === `reset-password:${token}`))!;
    expect(verification.value).toBe(created.id);
    expect(Date.parse(verification.expiresAt)).toBeGreaterThan(Date.now());
    await expect(usersAdmin.createStaffUser({ name: "Dup", email: "new.hire@example.com", role: "staff" }, ADMIN)).rejects.toMatchObject({ code: "email_taken" });
    await expect(usersAdmin.createStaffUser({ name: "Bad", email: "nope", role: "staff" }, ADMIN)).rejects.toMatchObject({ code: "validation_failed" });
    await expect(usersAdmin.createStaffUser({ name: "Bad", email: "x@example.com", role: "customer" as never }, ADMIN)).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("changes roles safely: no self edits, never the last admin, sessions revoked", async () => {
    await expect(usersAdmin.setUserRole("usr_admin", "staff", ADMIN)).rejects.toMatchObject({ code: "cannot_modify_self" });
    await expect(usersAdmin.setUserDisabled("usr_admin", true, ADMIN)).rejects.toMatchObject({ code: "cannot_modify_self" });
    await expect(usersAdmin.deleteUser("usr_admin", ADMIN)).rejects.toMatchObject({ code: "cannot_modify_self" });

    // staff cannot demote the only admin because that would leave none
    await expect(usersAdmin.setUserRole("usr_admin", "staff", STAFF)).rejects.toMatchObject({ code: "last_admin" });
    await expect(usersAdmin.setUserDisabled("usr_admin", true, STAFF)).rejects.toMatchObject({ code: "last_admin" });

    await db.authSessions.insert({ userId: "usr_staff", token: "tok_staff", expiresAt: new Date(Date.now() + 1e6).toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    const promoted = await usersAdmin.setUserRole("usr_staff", "admin", ADMIN);
    expect(promoted.role).toBe("admin");
    expect(await db.authSessions.count((s) => s.userId === "usr_staff")).toBe(0);
    // with a second admin, the first may now be demoted by the second
    const demoted = await usersAdmin.setUserRole("usr_admin", "staff", { id: "usr_staff", email: STAFF.email, role: "admin" });
    expect(demoted.role).toBe("staff");
    await usersAdmin.setUserRole("usr_admin", "admin", { id: "usr_staff", email: STAFF.email, role: "admin" });
    await usersAdmin.setUserRole("usr_staff", "staff", ADMIN);
    await expect(usersAdmin.setUserRole("usr_missing", "staff", ADMIN)).rejects.toMatchObject({ code: "not_found" });
    await expect(usersAdmin.setUserRole("usr_c01", "root" as never, ADMIN)).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("disables accounts (revoking sessions), re-enables them, and writes the audit trail", async () => {
    await db.authSessions.insert({ userId: "usr_c01", token: "tok_c01", expiresAt: new Date(Date.now() + 1e6).toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    const off = await usersAdmin.setUserDisabled("usr_c01", true, ADMIN);
    expect(off.disabled).toBe(true);
    expect(await db.authSessions.count((s) => s.userId === "usr_c01")).toBe(0);
    expect((await usersAdmin.setUserDisabled("usr_c01", true, ADMIN)).disabled).toBe(true); // idempotent
    expect((await usersAdmin.setUserDisabled("usr_c01", false, ADMIN)).disabled).toBe(false);
    const actions = (await db.auditLog.find({ where: (a) => a.entityId === "usr_c01" })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["user.disable", "user.enable"]));
  });

  it("sends a password reset link and deletes users on request", async () => {
    const before = mail().length;
    await usersAdmin.sendPasswordReset("usr_c02", ADMIN);
    const reset = mail().slice(before).find((m) => m.template === "password_reset")!;
    expect(reset.to).toBe("liam.oconnor@mail.example");
    await expect(usersAdmin.sendPasswordReset("usr_missing", ADMIN)).rejects.toMatchObject({ code: "not_found" });
    await usersAdmin.deleteUser("usr_c02", ADMIN);
    expect(await db.users.get("usr_c02")).toBeNull();
    expect((await db.auditLog.find({ where: (a) => a.action === "user.delete" })).at(-1)?.actor.id).toBe(ADMIN.id);
  });
});

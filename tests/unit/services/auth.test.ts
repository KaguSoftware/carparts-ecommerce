import { ADMIN, CARD_OK, freshSeed, STAFF } from "../helpers/test-env";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";

/* ---- a tiny stand-in for the Next.js request scope: one cookie jar acts as the browser ---- */
const { scope, nextHeadersMock } = vi.hoisted(() => {
  process.env.TRUST_PROXY = "true"; // client IPs come from x-forwarded-for in these tests
  const scope = { jar: new Map<string, string>(), ip: "198.51.100.7" };
  const nextHeadersMock = () => ({
    headers: async () =>
      new Headers({
        cookie: [...scope.jar].map(([k, v]) => `${k}=${v}`).join("; "),
        "user-agent": "vitest",
        origin: "http://localhost:3000",
        "x-forwarded-for": scope.ip,
      }),
    cookies: async () => ({
      get: (name: string) => (scope.jar.has(name) ? { name, value: scope.jar.get(name) as string } : undefined),
      set: (name: string, value: string, options?: { maxAge?: number }) => {
        if (options?.maxAge === 0 || value === "") scope.jar.delete(name);
        else scope.jar.set(name, value);
      },
      delete: (name: string) => scope.jar.delete(name),
    }),
  });
  return { scope, nextHeadersMock };
});

// Better Auth imports "next/headers.js" (with extension): mock both specifiers.
vi.mock("next/headers", nextHeadersMock);
vi.mock("next/headers.js", nextHeadersMock);
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT ${url}`), { digest: `NEXT_REDIRECT;${url}` });
  },
}));

vi.mock("@/i18n/navigation", () => ({
  redirect: (args: { href: { pathname: string; query?: Record<string, string> }; locale: string }) => {
    const query = args.href.query ? `?${new URLSearchParams(args.href.query)}` : "";
    const url = `/${args.locale}${args.href.pathname}${query}`;
    throw Object.assign(new Error(`NEXT_REDIRECT ${url}`), { digest: `NEXT_REDIRECT;${url}` });
  },
}));

import { db } from "@/lib/db";
import { outboxDir } from "@/lib/email";
import { createAuth } from "@/lib/auth/auth";
import { createPasswordSetupUrl } from "@/lib/auth/password-links";
import * as credentials from "@/lib/auth/credentials";
import * as session from "@/lib/auth/session";
import { lockoutKey, registerLoginFailure, assertNotLocked, registerLoginSuccess, lockoutRemainingSeconds, MAX_FAILURES } from "@/lib/security/lockout";
import { resetRateLimits } from "@/lib/security/rate-limit";
import { getCartId, getVehicleSelection, setCartId, setVehicleSelection, clearVehicleSelection, getAdminLocale, setAdminLocale, clearCartId } from "@/lib/session/cookies";
import * as cart from "@/lib/services/cart";
import * as checkout from "@/lib/services/checkout";
import { SEED_CREDENTIALS } from "@/lib/db/seed/credentials";
import { randomUUID } from "node:crypto";

const auth = createAuth({ cookies: false });
const mail = () => (fs.existsSync(outboxDir()) ? fs.readdirSync(outboxDir()).sort().map((n) => JSON.parse(fs.readFileSync(`${outboxDir()}/${n}`, "utf8")) as { template: string; to: string; text: string; subject: string }) : []);
const headersFor = (ip = scope.ip) => new Headers({ "x-forwarded-for": ip, origin: "http://localhost:3000" });

beforeAll(async () => {
  await freshSeed();
}, 60_000);

beforeEach(() => {
  scope.jar.clear();
  scope.ip = "198.51.100.7";
  resetRateLimits();
});

describe("Better Auth on the JSON adapter", () => {
  it("signs in a seeded account (scrypt hashes from the seed verify) and persists the session", async () => {
    const result = await auth.api.signInEmail({ body: { email: SEED_CREDENTIALS.customer.email, password: SEED_CREDENTIALS.customer.password }, headers: headersFor() });
    expect(result.user).toMatchObject({ id: "usr_customer", email: "customer@apexline.example", role: "customer", emailVerified: true });
    expect(result.token).toBeTruthy();
    const row = await db.authSessions.findOne((s) => s.userId === "usr_customer" && s.token === result.token);
    expect(row).toBeTruthy();
    expect(typeof row!.expiresAt).toBe("string"); // dates are stored as ISO strings
    expect(Date.parse(row!.expiresAt)).toBeGreaterThan(Date.now() + 13 * 86_400_000);
    expect((await db.users.get("usr_customer"))!.lastLoginAt).toBeTruthy();
  });

  it("gives the same error for a wrong password and an unknown email (no enumeration)", async () => {
    const wrong = await auth.api.signInEmail({ body: { email: SEED_CREDENTIALS.customer.email, password: "WrongPassword#1" }, headers: headersFor("203.0.113.1") }).catch((e) => e);
    const unknown = await auth.api.signInEmail({ body: { email: "nobody@example.com", password: "WrongPassword#1" }, headers: headersFor("203.0.113.2") }).catch((e) => e);
    expect(wrong.body.code).toBe("INVALID_EMAIL_OR_PASSWORD");
    expect(unknown.body.code).toBe(wrong.body.code);
    expect(unknown.body.message).toBe(wrong.body.message);
  });

  it("locks an email+IP pair after 5 failures for 10 minutes, even for the right password", async () => {
    const email = "sofia.marino@mail.example";
    const ip = "203.0.113.50";
    for (let i = 0; i < MAX_FAILURES; i++) {
      const err = await auth.api.signInEmail({ body: { email, password: "Nope-Nope-123" }, headers: headersFor(ip) }).catch((e) => e);
      expect(err.body.code).toBe("INVALID_EMAIL_OR_PASSWORD");
    }
    const locked = await auth.api.signInEmail({ body: { email, password: SEED_CREDENTIALS.customer.password }, headers: headersFor(ip) }).catch((e) => e);
    expect(locked.body.code).toBe("ACCOUNT_LOCKED");
    expect(await lockoutRemainingSeconds(lockoutKey(email, ip))).toBeGreaterThan(590);
    // another IP, or another account, is unaffected
    await expect(auth.api.signInEmail({ body: { email, password: SEED_CREDENTIALS.customer.password }, headers: headersFor("203.0.113.51") })).resolves.toBeTruthy();
    const other = await auth.api.signInEmail({ body: { email: "liam.oconnor@mail.example", password: "Nope-Nope-123" }, headers: headersFor(ip) }).catch((e) => e);
    expect(other.body.code).toBe("INVALID_EMAIL_OR_PASSWORD");
    // the stored key is hashed: the e-mail address is not written to the lockout table
    expect(JSON.stringify(await db.loginAttempts.all())).not.toContain("sofia");
  });

  it("lockout helpers: counter resets on success, decays, and expires", async () => {
    const key = lockoutKey("x@example.com", "9.9.9.9");
    for (let i = 0; i < MAX_FAILURES - 1; i++) expect((await registerLoginFailure(key)).locked).toBe(false);
    await registerLoginSuccess(key);
    for (let i = 0; i < MAX_FAILURES - 1; i++) expect((await registerLoginFailure(key)).locked).toBe(false);
    expect((await registerLoginFailure(key)).locked).toBe(true);
    await expect(assertNotLocked(key)).rejects.toMatchObject({ code: "account_locked", status: 429 });
    // lock expires
    const later = Date.now() + 11 * 60_000;
    expect(await lockoutRemainingSeconds(key, later)).toBe(0);
    // stale partial failures decay
    const key2 = lockoutKey("y@example.com", "9.9.9.9");
    const old = Date.now() - 40 * 60_000;
    for (let i = 0; i < MAX_FAILURES - 1; i++) await registerLoginFailure(key2, old);
    expect((await registerLoginFailure(key2)).failures).toBe(1);
  });

  it("refuses sessions for disabled accounts", async () => {
    await db.users.update("usr_c03", { disabled: true });
    const err = await auth.api.signInEmail({ body: { email: "aylin.demir@mail.example", password: SEED_CREDENTIALS.customer.password }, headers: headersFor("203.0.113.60") }).catch((e) => e);
    expect(err.body.code).toBe("ACCOUNT_DISABLED");
    expect(await db.authSessions.count((s) => s.userId === "usr_c03")).toBe(0);
    await db.users.update("usr_c03", { disabled: false });
  });

  it("sign-up creates customers only: role cannot be injected, passwords are hashed, verification mail is sent", async () => {
    const before = mail().length;
    const result = await auth.api.signUpEmail({
      body: { name: "Mallory", email: "Mallory@Example.com", password: "Str0ng-Password!", role: "admin", disabled: false, locale: "tr" } as never,
      headers: headersFor("203.0.113.70"),
    });
    expect(result.user).toMatchObject({ email: "mallory@example.com", role: "customer", locale: "tr" });
    const stored = (await db.users.get(result.user.id))!;
    expect(stored.role).toBe("customer");
    const account = (await db.authAccounts.findOne((a) => a.userId === stored.id))!;
    expect(account.password).toMatch(/^[0-9a-f]+:[0-9a-f]+$/); // salt:key, never plain text
    expect(account.password).not.toContain("Str0ng");
    const verify = mail().slice(before).find((m) => m.template === "verify_email");
    expect(verify).toMatchObject({ to: "mallory@example.com" });
    expect(verify!.subject).toBe("E-posta adresinizi doğrulayın"); // Turkish user -> Turkish mail

    const short = await auth.api.signUpEmail({ body: { name: "Short", email: "short@example.com", password: "short" }, headers: headersFor("203.0.113.71") }).catch((e) => e);
    expect(short.body.code).toBe("PASSWORD_TOO_SHORT");
    const dup = await auth.api.signUpEmail({ body: { name: "Dup", email: "mallory@example.com", password: "Str0ng-Password!" }, headers: headersFor("203.0.113.72") }).catch((e) => e);
    expect(dup.statusCode).toBe(422);
    const badLocale = await auth.api.signUpEmail({ body: { name: "L", email: "locale@example.com", password: "Str0ng-Password!", locale: "xx" } as never, headers: headersFor("203.0.113.73") }).catch((e) => e);
    expect(badLocale.statusCode).toBeGreaterThanOrEqual(400);
  });
});

describe("credential flows used by Server Actions", () => {
  it("signs in, sets the session cookie, and exposes the user through the session helpers", async () => {
    expect(await session.getSessionUser()).toBeNull();
    const user = await credentials.signInWithPassword({ email: " Customer@Apexline.example ", password: SEED_CREDENTIALS.customer.password });
    expect(user).toMatchObject({ id: "usr_customer", role: "customer", locale: "en" });
    expect([...scope.jar.keys()].some((k) => k.endsWith("session_token"))).toBe(true);
    expect(await session.assertUser()).toMatchObject({ id: "usr_customer" });
    expect(session.toActor(user)).toEqual({ id: "usr_customer", email: "customer@apexline.example", role: "customer" });

    const sessionsBefore = await db.authSessions.count((s) => s.userId === "usr_customer");
    await credentials.signOutCurrentUser();
    expect(await db.authSessions.count((s) => s.userId === "usr_customer")).toBe(sessionsBefore - 1);
    scope.jar.clear();
    await expect(session.assertUser()).rejects.toMatchObject({ code: "unauthorized", status: 401 });
  });

  it("maps failures to domain errors without leaking whether the account exists", async () => {
    await expect(credentials.signInWithPassword({ email: "customer@apexline.example", password: "nope-nope-123" })).rejects.toMatchObject({ code: "invalid_credentials" });
    await expect(credentials.signInWithPassword({ email: "ghost@example.com", password: "nope-nope-123" })).rejects.toMatchObject({ code: "invalid_credentials" });
    await expect(credentials.signInWithPassword({ email: "not-an-email", password: "x" })).rejects.toMatchObject({ code: "invalid_credentials" });
    await expect(credentials.signInWithPassword({ email: "customer@apexline.example", password: "" })).rejects.toMatchObject({ code: "invalid_credentials" });
    scope.ip = "198.51.100.99";
    for (let i = 0; i < MAX_FAILURES; i++) await credentials.signInWithPassword({ email: "staff@apexline.example", password: "bad-bad-bad-1" }).catch(() => undefined);
    await expect(credentials.signInWithPassword({ email: "staff@apexline.example", password: SEED_CREDENTIALS.staff.password })).rejects.toMatchObject({ code: "account_locked", status: 429 });
    await db.users.update("usr_c04", { disabled: true });
    await expect(credentials.signInWithPassword({ email: "kaan.yildiz@mail.example", password: SEED_CREDENTIALS.customer.password })).rejects.toMatchObject({ code: "account_disabled" });
    await db.users.update("usr_c04", { disabled: false });
  });

  it("rate limits sign-in attempts per client and email", async () => {
    scope.ip = "198.51.100.120";
    let limited = 0;
    for (let i = 0; i < 40; i++) {
      await credentials.signInWithPassword({ email: "ratelimit.target@example.com", password: "bad-bad-bad-1" }).catch((e) => {
        if (e.code === "rate_limited") limited++;
      });
    }
    expect(limited).toBeGreaterThan(5);
  });

  it("registers with the password policy, merges the guest cart and starts a session", async () => {
    await expect(credentials.signUpWithPassword({ name: "A", email: "bad", password: "weak", locale: "en" })).rejects.toMatchObject({ code: "validation_failed", fieldErrors: { email: ["email_invalid"], password: ["password_too_short"] } });
    await expect(credentials.signUpWithPassword({ name: "A", email: "a@example.com", password: "alllowercase1234", locale: "en" })).rejects.toMatchObject({ fieldErrors: { password: ["password_weak"] } });
    await expect(credentials.signUpWithPassword({ name: "", email: "a@example.com", password: "Str0ng-Password!", locale: "en" })).rejects.toMatchObject({ fieldErrors: { name: ["required"] } });
    await expect(credentials.signUpWithPassword({ name: "Dup", email: "customer@apexline.example", password: "Str0ng-Password!", locale: "en" })).rejects.toMatchObject({ code: "email_taken" });

    // a guest fills a cart, then registers
    const guest = await cart.getOrCreateCart({});
    const variant = (await db.variants.find({ where: (v) => v.isActive && v.stockOnHand - v.stockReserved > 5 }))[0]!;
    await cart.addItem(guest.id, variant.id, 2);
    await setCartId(guest.id);
    const user = await credentials.signUpWithPassword({ name: "New Shopper", email: "new.shopper@example.com", password: "Str0ng-Password!", locale: "tr", marketingOptIn: true });
    expect(user).toMatchObject({ email: "new.shopper@example.com", role: "customer", locale: "tr" });
    expect(await db.users.get(user.id)).toMatchObject({ marketingOptIn: true });
    const userCart = (await db.carts.findOne((c) => c.userId === user.id))!;
    expect(userCart.items).toEqual([expect.objectContaining({ variantId: variant.id, quantity: 2 })]);
    expect(await getCartId()).toBe(userCart.id);
  });

  it("merges a guest cart into the account cart on sign-in", async () => {
    const variants = await db.variants.find({ where: (v) => v.isActive && v.stockOnHand - v.stockReserved > 8 });
    const [a, b] = [variants[1]!, variants[2]!];
    const userCart = await cart.getOrCreateCart({ userId: "usr_customer" });
    await cart.setItemQuantity(userCart.id, a.id, 1);
    const guest = await cart.getOrCreateCart({});
    await cart.addItem(guest.id, a.id, 2);
    await cart.addItem(guest.id, b.id, 1);
    await setCartId(guest.id);
    await credentials.signInWithPassword({ email: "customer@apexline.example", password: SEED_CREDENTIALS.customer.password });
    const merged = (await db.carts.get(userCart.id))!;
    expect(Object.fromEntries(merged.items.map((i) => [i.variantId, i.quantity]))).toMatchObject({ [a.id]: 3, [b.id]: 1 });
    expect(await getCartId()).toBe(userCart.id);
    expect(await db.carts.get(guest.id)).toBeNull();
  });

  it("password reset: emails a link, accepts the token once, revokes sessions, and the new password works", async () => {
    await credentials.signInWithPassword({ email: "emma.schneider@mail.example", password: SEED_CREDENTIALS.customer.password });
    expect(await db.authSessions.count((s) => s.userId === "usr_c05")).toBe(1);
    scope.jar.clear();
    const before = mail().length;

    await credentials.requestPasswordReset({ email: "Emma.Schneider@mail.example", locale: "en" });
    const email = mail().slice(before).find((m) => m.template === "password_reset")!;
    expect(email.to).toBe("emma.schneider@mail.example");
    const token = /reset-password\/([A-Za-z0-9_-]+)\?/.exec(email.text)?.[1];
    expect(token).toBeTruthy();
    expect(email.text).toContain("callbackURL=http%3A%2F%2Flocalhost%3A3000%2Fen%2Freset-password");

    // unknown addresses behave identically (and send nothing)
    const count = mail().length;
    await expect(credentials.requestPasswordReset({ email: "ghost@example.com", locale: "en" })).resolves.toBeUndefined();
    expect(mail().length).toBe(count);

    await expect(credentials.resetPasswordWithToken({ token: token!, newPassword: "short" })).rejects.toMatchObject({ code: "validation_failed" });
    await expect(credentials.resetPasswordWithToken({ token: "bogus-token", newPassword: "Brand-New-Pass1" })).rejects.toMatchObject({ code: "invalid_token" });
    await credentials.resetPasswordWithToken({ token: token!, newPassword: "Brand-New-Pass1" });
    await expect(credentials.resetPasswordWithToken({ token: token!, newPassword: "Another-New-Pass1" })).rejects.toMatchObject({ code: "invalid_token" }); // single use
    expect(await db.authSessions.count((s) => s.userId === "usr_c05")).toBe(0);

    await expect(credentials.signInWithPassword({ email: "emma.schneider@mail.example", password: SEED_CREDENTIALS.customer.password })).rejects.toMatchObject({ code: "invalid_credentials" });
    await expect(credentials.signInWithPassword({ email: "emma.schneider@mail.example", password: "Brand-New-Pass1" })).resolves.toMatchObject({ id: "usr_c05" });
  });

  it("an invitation link from the admin panel sets the first password", async () => {
    const created = await (await import("@/lib/services/users-admin")).createStaffUser({ name: "Casey Staff", email: "casey@example.com", role: "staff" }, ADMIN);
    const url = await createPasswordSetupUrl(created.id, { locale: "en" });
    const token = /reset-password\/([A-Za-z0-9_-]+)\?/.exec(url)![1]!;
    await credentials.resetPasswordWithToken({ token, newPassword: "Welcome-Aboard-1" });
    const user = await credentials.signInStaff({ email: "casey@example.com", password: "Welcome-Aboard-1" });
    expect(user).toMatchObject({ role: "staff" });
  });

  it("changes the password for the signed-in user only when the current one is right", async () => {
    await credentials.signInWithPassword({ email: "noor.haddad@mail.example", password: SEED_CREDENTIALS.customer.password });
    await expect(credentials.changePasswordForCurrentUser({ currentPassword: "wrong-wrong-1", newPassword: "Fresh-Password-9" })).rejects.toMatchObject({ code: "password_incorrect" });
    await expect(credentials.changePasswordForCurrentUser({ currentPassword: SEED_CREDENTIALS.customer.password, newPassword: "weak" })).rejects.toMatchObject({ code: "validation_failed" });
    await credentials.changePasswordForCurrentUser({ currentPassword: SEED_CREDENTIALS.customer.password, newPassword: "Fresh-Password-9" });
    scope.jar.clear();
    await expect(credentials.signInWithPassword({ email: "noor.haddad@mail.example", password: "Fresh-Password-9" })).resolves.toMatchObject({ id: "usr_c06" });
    scope.jar.clear();
    await expect(credentials.changePasswordForCurrentUser({ currentPassword: "x", newPassword: "Fresh-Password-9" })).rejects.toBeTruthy(); // signed out
  });
});

describe("authorization helpers", () => {
  it("assertStaff / requireStaff enforce role and permission", async () => {
    await expect(session.assertStaff()).rejects.toMatchObject({ code: "unauthorized" });
    await expect(session.requireStaff()).rejects.toMatchObject({ digest: "NEXT_REDIRECT;/admin/login" });
    await expect(session.requireUser("tr", "/account/orders")).rejects.toMatchObject({ digest: "NEXT_REDIRECT;/tr/login?next=%2Faccount%2Forders" });

    await credentials.signInWithPassword({ email: "customer@apexline.example", password: SEED_CREDENTIALS.customer.password });
    await expect(session.assertStaff()).rejects.toMatchObject({ code: "forbidden", status: 403 });
    await expect(session.requireStaff("catalog.read")).rejects.toMatchObject({ code: "forbidden" });
    scope.jar.clear();

    await credentials.signInWithPassword({ email: SEED_CREDENTIALS.staff.email, password: SEED_CREDENTIALS.staff.password });
    expect(await session.assertStaff("orders.write")).toMatchObject({ id: "usr_staff", role: "staff" });
    await expect(session.assertStaff("orders.refund")).rejects.toMatchObject({ code: "forbidden" });
    await expect(session.requireStaff("settings.write")).rejects.toMatchObject({ code: "forbidden" });
    scope.jar.clear();

    await credentials.signInWithPassword({ email: SEED_CREDENTIALS.admin.email, password: SEED_CREDENTIALS.admin.password });
    expect(await session.assertStaff("orders.refund")).toMatchObject({ role: "admin" });
    expect(await session.requireStaff("audit.read")).toMatchObject({ id: "usr_admin" });
    expect(session.can("admin", "users.manage")).toBe(true);
    expect(await session.assertRole(["admin"])).toMatchObject({ id: "usr_admin" });
    expect(await session.requireRole("admin")).toMatchObject({ id: "usr_admin" });
    await expect(session.assertRole("staff")).rejects.toMatchObject({ code: "forbidden" });
    await expect(session.requireRole(["customer", "staff"])).rejects.toMatchObject({ code: "forbidden" });
    scope.jar.clear();
    await expect(session.assertRole("admin")).rejects.toMatchObject({ code: "unauthorized" });
    await expect(session.requireRole("admin")).rejects.toMatchObject({ digest: "NEXT_REDIRECT;/admin/login" });
  });

  it("role changes and disabling apply on the very next request (no cookie cache)", async () => {
    await credentials.signInWithPassword({ email: SEED_CREDENTIALS.staff.email, password: SEED_CREDENTIALS.staff.password });
    expect((await session.getSessionUser())?.role).toBe("staff");
    await db.users.update("usr_staff", { role: "customer" });
    scope.jar.set("noop", "1"); // new request scope
    expect((await session.getSessionUser())?.role).toBe("customer");
    await db.users.update("usr_staff", { role: "staff", disabled: true });
    expect(await session.getSessionUser()).toBeNull();
    await db.users.update("usr_staff", { disabled: false });
  });

  it("customer sessions cannot linger via the admin sign-in", async () => {
    const before = await db.authSessions.count((s) => s.userId === "usr_customer");
    await expect(credentials.signInStaff({ email: "customer@apexline.example", password: SEED_CREDENTIALS.customer.password })).rejects.toMatchObject({ code: "forbidden" });
    expect(await db.authSessions.count((s) => s.userId === "usr_customer")).toBe(before); // the session it just opened was revoked
    expect(await credentials.revokeUserSessions("usr_staff")).toBeGreaterThanOrEqual(0);
  });
});

describe("cookie helpers", () => {
  it("stores the cart id signed, ignores forged cookies and clears them", async () => {
    await setCartId("crt_abc");
    expect([...scope.jar.entries()].find(([k]) => k === "cart_id")![1]).toMatch(/^crt_abc\./);
    expect(await getCartId()).toBe("crt_abc");
    scope.jar.set("cart_id", "crt_abc.forged");
    expect(await getCartId()).toBeNull();
    await clearCartId();
    expect(scope.jar.has("cart_id")).toBe(false);
  });

  it("round-trips the vehicle selection and the admin locale", async () => {
    expect(await getVehicleSelection()).toEqual({});
    await setVehicleSelection({ makeId: "mak_bmw", modelId: "mdl_bmw-3", year: 2019 });
    expect(await getVehicleSelection()).toEqual({ makeId: "mak_bmw", modelId: "mdl_bmw-3", year: 2019 });
    await expect(setVehicleSelection({ year: "2019" } as never)).rejects.toBeTruthy();
    await clearVehicleSelection();
    expect(await getVehicleSelection()).toEqual({});
    expect(await getAdminLocale()).toBe("en");
    await setAdminLocale("tr");
    expect(await getAdminLocale()).toBe("tr");
    await setAdminLocale("fr" as never);
    expect(await getAdminLocale()).toBe("tr");
  });
});

describe("end to end: sign in, check out as an account holder", () => {
  it("a signed-in customer places an order that belongs to the account", async () => {
    const user = await credentials.signInWithPassword({ email: "customer@apexline.example", password: SEED_CREDENTIALS.customer.password });
    const c = await cart.getOrCreateCart({ userId: user.id });
    const variant = (await db.variants.find({ where: (v) => v.isActive && v.stockOnHand - v.stockReserved > 5 && v.price > 1000 }))[3]!;
    await cart.addItem(c.id, variant.id, 1);
    const result = await checkout.placeOrder({
      cartId: c.id,
      userId: user.id,
      email: user.email,
      shippingAddress: { firstName: "Deniz", lastName: "Kaya", line1: "2418 Cass Ave", city: "Detroit", region: "MI", postalCode: "48201", country: "US", phone: "+1 313 555 0142" },
      shippingMethodId: "shp_standard",
      locale: "en",
      idempotencyKey: randomUUID(),
      payment: { type: "card", card: CARD_OK },
      saveAddress: true,
    });
    expect(result.status).toBe("succeeded");
    expect((result as { order: { userId: string } }).order.userId).toBe("usr_customer");
    expect(STAFF.id).toBe("usr_staff");
  });
});

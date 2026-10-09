import { CARD_OK, freshSeed, US_ADDRESS } from "../helpers/test-env";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

const { scope, nextHeadersMock } = vi.hoisted(() => {
  process.env.TRUST_PROXY = "true";
  const scope = { jar: new Map<string, string>(), ip: "198.51.100.20" };
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
vi.mock("next/headers", nextHeadersMock);
vi.mock("next/headers.js", nextHeadersMock);
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`NEXT_REDIRECT ${url}`); } }));
vi.mock("@/i18n/navigation", () => ({ redirect: () => { throw new Error("NEXT_REDIRECT"); } }));

import { db } from "@/lib/db";
import { signInStaff, signInWithPassword } from "@/lib/auth/credentials";
import { getAuth } from "@/lib/auth/auth";
import { signWebhookPayload } from "@/lib/payments";
import { resetRateLimits } from "@/lib/security/rate-limit";
import { SEED_CREDENTIALS } from "@/lib/db/seed/credentials";
import { detectImageType, isSafeSvg, readUpload, saveImageUpload, uploadDir } from "@/lib/uploads";
import { assertSameOrigin, problem, readJson, searchParamsObject, validate } from "@/lib/api/respond";
import { DomainError } from "@/lib/errors";
import { z } from "zod";
import * as checkout from "@/lib/services/checkout";
import * as cart from "@/lib/services/cart";
import * as health from "@/app/api/health/route";
import * as products from "@/app/api/products/route";
import * as productBySlug from "@/app/api/products/[slug]/route";
import * as makes from "@/app/api/vehicles/makes/route";
import * as models from "@/app/api/vehicles/models/route";
import * as years from "@/app/api/vehicles/years/route";
import * as engines from "@/app/api/vehicles/engines/route";
import * as selection from "@/app/api/vehicle/selection/route";
import * as suggest from "@/app/api/search/suggest/route";
import * as cartRoute from "@/app/api/cart/route";
import * as couponRoute from "@/app/api/cart/coupon/route";
import * as newsletterRoute from "@/app/api/newsletter/route";
import * as contactRoute from "@/app/api/contact/route";
import * as helpful from "@/app/api/reviews/[id]/helpful/route";
import * as uploadsRoute from "@/app/api/uploads/route";
import * as uploadsServe from "@/app/uploads/[...path]/route";
import * as exportOrders from "@/app/api/admin/export/orders/route";
import * as exportProducts from "@/app/api/admin/export/products/route";
import * as exportSubscribers from "@/app/api/admin/export/subscribers/route";
import * as importProducts from "@/app/api/admin/import/products/route";
import * as webhook from "@/app/api/webhooks/payments/route";
import * as authRoute from "@/app/api/auth/[...all]/route";

const ORIGIN = "http://localhost:3000";
const url = (path: string) => `${ORIGIN}${path}`;
const get = (path: string, headers: Record<string, string> = {}) => new Request(url(path), { headers });
const send = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(url(path), { method, headers: { origin: ORIGIN, "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const body = async (res: Response) => (await res.json()) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));

function multipart(name: string, bytes: Uint8Array, type: string, filename = "image.bin", headers: Record<string, string> = {}) {
  const form = new FormData();
  form.set("file", new File([bytes as BlobPart], filename, { type }));
  return new Request(url("/api/uploads"), { method: "POST", body: form, headers: { origin: ORIGIN, ...headers } });
}

beforeAll(async () => {
  await freshSeed();
}, 60_000);

beforeEach(() => {
  scope.jar.clear();
  scope.ip = "198.51.100.20";
  resetRateLimits();
});

describe("helpers", () => {
  it("problem() maps domain errors, rate limits and surprises", async () => {
    const res = problem(new DomainError("cart_not_found", { status: 404, params: { what: "cart" } }));
    expect(res.status).toBe(404);
    expect(await body(res)).toEqual({ error: "cart_not_found", errorParams: { what: "cart" } });
    const limited = problem(new DomainError("rate_limited", { status: 429, params: { retryAfter: 42 } }));
    expect(limited.headers.get("retry-after")).toBe("42");
    const unknown = problem(new Error("secret internals"));
    expect(unknown.status).toBe(500);
    expect(JSON.stringify(await body(unknown))).not.toContain("secret");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("validate() reports codes, never English sentences", () => {
    try {
      validate(z.object({ id: z.string(), n: z.number().max(3), tags: z.array(z.string()).min(1) }), { n: 9, tags: [] });
      throw new Error("should fail");
    } catch (e) {
      expect((e as DomainError).fieldErrors).toEqual({ id: ["required"], n: ["too_large"], tags: ["required"] });
    }
  });

  it("readJson enforces content type, size and syntax; assertSameOrigin blocks cross-site writes", async () => {
    const schema = z.object({ a: z.number() });
    await expect(readJson(new Request(url("/x"), { method: "POST", body: "a=1", headers: { "content-type": "application/x-www-form-urlencoded" } }), schema)).rejects.toMatchObject({ status: 415 });
    await expect(readJson(new Request(url("/x"), { method: "POST", body: "{nope", headers: { "content-type": "application/json" } }), schema)).rejects.toMatchObject({ code: "validation_failed" });
    await expect(readJson(new Request(url("/x"), { method: "POST", body: JSON.stringify({ a: "x".repeat(200) }), headers: { "content-type": "application/json" } }), schema, { maxBytes: 100 })).rejects.toMatchObject({ status: 413 });
    await expect(readJson(send("POST", "/x", { a: 1 }), schema)).resolves.toEqual({ a: 1 });
    expect(() => assertSameOrigin(new Request(url("/x"), { headers: { origin: "https://evil.example" } }))).toThrowError(expect.objectContaining({ code: "forbidden" }));
    expect(() => assertSameOrigin(new Request(url("/x"), { headers: { origin: ORIGIN } }))).not.toThrow();
    expect(() => assertSameOrigin(new Request(url("/x")))).not.toThrow();
    expect(searchParamsObject(new URL(url("/x?a=1&a=2&b=3")))).toEqual({ a: "1", b: "3" });
  });
});

describe("health and catalog routes", () => {
  it("GET /api/health", async () => {
    const res = await health.GET();
    expect(res.status).toBe(200);
    expect(await body(res)).toMatchObject({ status: "ok", version: expect.any(String) });
  });

  it("GET /api/products filters, sorts, paginates and is publicly cacheable", async () => {
    const res = await products.GET(get("/api/products?category=brakes&sort=price_asc&pageSize=5&inStock=1&locale=tr"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("s-maxage=30");
    const data = await body(res);
    expect(data.items).toHaveLength(5);
    expect(data.pageSize).toBe(5);
    const prices = data.items.map((i: { priceFrom: number }) => i.priceFrom);
    expect(prices).toEqual([...prices].sort((a: number, b: number) => a - b));
    expect(data.facets.brands.length).toBeGreaterThan(0);

    const search = await body(await products.GET(get("/api/products?q=brake%20pads&pageSize=3")));
    expect(search.total).toBeGreaterThan(0);
    const brand = data.facets.brands[0].slug;
    const filtered = await body(await products.GET(get(`/api/products?brand=${brand}&category=brakes&pageSize=100`)));
    expect(filtered.items.every((i: { brand: { slug: string } }) => i.brand.slug === brand)).toBe(true);
  });

  it("rejects malformed query parameters with field codes", async () => {
    const res = await products.GET(get("/api/products?pageSize=1000&sort=bogus&minPrice=abc"));
    expect(res.status).toBe(400);
    const data = await body(res);
    expect(data.error).toBe("validation_failed");
    expect(Object.keys(data.fieldErrors).sort()).toEqual(["minPrice", "pageSize", "sort"]);
    expect(Object.values(data.fieldErrors).flat().every((c) => /^[a-z_]+$/.test(c as string))).toBe(true);
  });

  it("GET /api/products/[slug]: 200 without cost prices, 404 for unknown and draft products", async () => {
    const slug = (await body(await products.GET(get("/api/products?pageSize=1")))).items[0].slug;
    const ok = await productBySlug.GET(get(`/api/products/${slug}`), { params: Promise.resolve({ slug }) });
    expect(ok.status).toBe(200);
    const detail = await body(ok);
    expect(detail.product.slug).toBe(slug);
    expect(JSON.stringify(detail.variants)).not.toContain('"cost"');
    const missing = await productBySlug.GET(get("/api/products/nope"), { params: Promise.resolve({ slug: "nope" }) });
    expect(missing.status).toBe(404);
    expect(await body(missing)).toMatchObject({ error: "not_found" });
    const draft = (await db.products.findOne((p) => p.status === "draft"))!;
    expect((await productBySlug.GET(get("/x"), { params: Promise.resolve({ slug: draft.slug }) })).status).toBe(404);
  });
});

describe("vehicle routes", () => {
  it("serves the make -> model -> year -> engine cascade", async () => {
    const m = (await body(await makes.GET())).makes[0];
    expect(m.id).toBeTruthy();
    const mdl = (await body(await models.GET(get(`/api/vehicles/models?makeId=${m.id}`)))).models[0];
    const ys = (await body(await years.GET(get(`/api/vehicles/years?modelId=${mdl.id}`)))).years;
    expect(ys[0]).toBeGreaterThanOrEqual(ys.at(-1));
    const eng = (await body(await engines.GET(get(`/api/vehicles/engines?modelId=${mdl.id}&year=${ys[0]}`)))).engines;
    expect(eng[0].label).toContain(m.name);
    expect((await models.GET(get("/api/vehicles/models"))).status).toBe(400);
    expect((await engines.GET(get(`/api/vehicles/engines?modelId=${mdl.id}&year=abc`))).status).toBe(400);
    expect((await makes.GET()).headers.get("cache-control")).toContain("public");
  });

  it("stores, reads and clears the vehicle selection cookie", async () => {
    const vehicle = (await db.vehicles.find({ limit: 1 }))[0]!;
    expect(await body(await selection.GET())).toEqual({ selection: {}, label: null });
    const put = await selection.PUT(send("PUT", "/api/vehicle/selection", { vehicleId: vehicle.id }));
    expect(put.status).toBe(200);
    expect((await body(put)).label).toContain(String(vehicle.year));
    expect(JSON.parse(scope.jar.get("vehicle")!)).toEqual({ vehicleId: vehicle.id });
    expect((await body(await selection.GET())).selection).toEqual({ vehicleId: vehicle.id });

    expect((await selection.PUT(send("PUT", "/api/vehicle/selection", { vehicleId: "veh_nope" }))).status).toBe(404);
    expect((await selection.PUT(send("PUT", "/api/vehicle/selection", { year: "2019" }))).status).toBe(400);
    expect((await selection.PUT(send("PUT", "/api/vehicle/selection", { vehicleId: vehicle.id, extra: 1 }))).status).toBe(400);
    expect((await selection.PUT(send("PUT", "/api/vehicle/selection", { vehicleId: vehicle.id }, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await selection.DELETE(send("DELETE", "/api/vehicle/selection"))).status).toBe(200);
    expect(scope.jar.has("vehicle")).toBe(false);
  });

  it("autocomplete honours the stored vehicle and validates input", async () => {
    const res = await suggest.GET(get("/api/search/suggest?q=brake&locale=tr&limit=3"));
    expect(res.status).toBe(200);
    const data = await body(res);
    expect(data.products.length).toBeLessThanOrEqual(3);
    expect(data.products.length).toBeGreaterThan(0);
    expect((await body(await suggest.GET(get("/api/search/suggest?q=b")))).products).toEqual([]);
    expect((await suggest.GET(get("/api/search/suggest?q=brake&limit=99"))).status).toBe(400);
    // rate limited per IP
    let last = 200;
    for (let i = 0; i < 125; i++) last = (await suggest.GET(get("/api/search/suggest?q=brake"))).status;
    expect(last).toBe(429);
  });
});

describe("cart routes", () => {
  const variantId = async () => (await db.variants.find({ where: (v) => v.isActive && v.stockOnHand - v.stockReserved > 15 && v.price > 1000 }))[2]!.id;

  it("builds a guest cart through a signed cookie", async () => {
    expect(await body(await cartRoute.GET())).toEqual({ cart: null, count: 0 });
    const v = await variantId();
    const add = await cartRoute.POST(send("POST", "/api/cart", { variantId: v, quantity: 2 }));
    expect(add.status).toBe(200);
    const data = await body(add);
    expect(data.count).toBe(2);
    expect(data.cart.lines[0]).toMatchObject({ variantId: v, quantity: 2 });
    expect(scope.jar.get("cart_id")).toMatch(/^crt_[a-z0-9]+\.[A-Za-z0-9_-]+$/);

    expect((await body(await cartRoute.GET())).count).toBe(2);
    const patched = await body(await cartRoute.PATCH(send("PATCH", "/api/cart", { variantId: v, quantity: 5 })));
    expect(patched.cart.lines[0].quantity).toBe(5);
    const withCoupon = await body(await couponRoute.POST(send("POST", "/api/cart/coupon", { code: "welcome10" })));
    expect(withCoupon.cart.coupon.code).toBe("WELCOME10");
    expect(withCoupon.cart.totals.discount).toBeGreaterThan(0);
    expect((await body(await couponRoute.DELETE(send("DELETE", "/api/cart/coupon")))).cart.coupon).toBeUndefined();

    const removed = await body(await cartRoute.DELETE(send("DELETE", `/api/cart?variantId=${v}`)));
    expect(removed.count).toBe(0);
    await cartRoute.POST(send("POST", "/api/cart", { variantId: v }));
    expect((await body(await cartRoute.DELETE(send("DELETE", "/api/cart")))).count).toBe(0);
  });

  it("rejects bad input, unknown coupons, cross-site writes and forged cookies", async () => {
    const v = await variantId();
    expect((await cartRoute.POST(send("POST", "/api/cart", { variantId: v, quantity: 50 }))).status).toBe(400);
    expect(await body(await cartRoute.POST(send("POST", "/api/cart", { variantId: v, quantity: 0 })))).toMatchObject({ error: "validation_failed" });
    expect((await cartRoute.POST(send("POST", "/api/cart", { variantId: "var_nope", quantity: 1 }))).status).toBe(409);
    expect((await cartRoute.POST(send("POST", "/api/cart", { variantId: v, quantity: 1 }, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await cartRoute.POST(new Request(url("/api/cart"), { method: "POST", body: "variantId=x", headers: { origin: ORIGIN, "content-type": "text/plain" } }))).status).toBe(415);
    expect(await body(await couponRoute.POST(send("POST", "/api/cart/coupon", { code: "WELCOME10" })))).toMatchObject({ error: expect.stringMatching(/cart_empty|coupon_invalid/) });
    await cartRoute.POST(send("POST", "/api/cart", { variantId: v, quantity: 1 }));
    expect(await body(await couponRoute.POST(send("POST", "/api/cart/coupon", { code: "NOPE" })))).toMatchObject({ error: "coupon_invalid" });

    scope.jar.set("cart_id", "crt_someoneelse.forgedsignature");
    expect(await body(await cartRoute.GET())).toEqual({ cart: null, count: 0 });
  });

  it("signed-in users get their account cart, never a stranger's", async () => {
    const v = await variantId();
    const other = await cart.getOrCreateCart({ userId: "usr_c01" });
    await cart.addItem(other.id, v, 1);
    await signInWithPassword({ email: "customer@apexline.example", password: SEED_CREDENTIALS.customer.password });
    const add = await body(await cartRoute.POST(send("POST", "/api/cart", { variantId: v, quantity: 1 })));
    expect(add.cart.id).not.toBe(other.id);
    expect((await db.carts.get(add.cart.id))!.userId).toBe("usr_customer");
  });
});

describe("public write routes", () => {
  it("newsletter: validates, deduplicates and rate limits", async () => {
    const ok = await newsletterRoute.POST(send("POST", "/api/newsletter", { email: "reader@example.com", locale: "tr", source: "footer" }));
    expect(await body(ok)).toEqual({ alreadySubscribed: false });
    expect(await body(await newsletterRoute.POST(send("POST", "/api/newsletter", { email: "reader@example.com" })))).toEqual({ alreadySubscribed: true });
    const bad = await newsletterRoute.POST(send("POST", "/api/newsletter", { email: "nope" }));
    expect(bad.status).toBe(400);
    expect(await body(bad)).toMatchObject({ fieldErrors: { email: ["email_invalid"] } });
    expect((await newsletterRoute.POST(send("POST", "/api/newsletter", { email: "x@example.com" }, { origin: "https://evil.example" }))).status).toBe(403);
    resetRateLimits();
    let status = 200;
    for (let i = 0; i < 7; i++) status = (await newsletterRoute.POST(send("POST", "/api/newsletter", { email: `n${i}@example.com` }))).status;
    expect(status).toBe(429);
  });

  it("contact: stores the message and limits abuse", async () => {
    const payload = { name: "Ann", email: "ann@example.com", subject: "Fitment question", message: "Does this fit a 2019 Corolla?", locale: "en" };
    const res = await contactRoute.POST(send("POST", "/api/contact", payload));
    expect(res.status).toBe(201);
    const { id } = await body(res);
    expect(await db.contactMessages.get(id)).toMatchObject({ email: "ann@example.com", status: "new" });
    expect((await contactRoute.POST(send("POST", "/api/contact", { ...payload, message: "short" }))).status).toBe(400);
    let status = 201;
    for (let i = 0; i < 6; i++) status = (await contactRoute.POST(send("POST", "/api/contact", payload))).status;
    expect(status).toBe(429);
  });

  it("review helpful votes: one per visitor", async () => {
    const review = (await db.reviews.findOne((r) => r.status === "approved"))!;
    const first = await helpful.POST(send("POST", `/api/reviews/${review.id}/helpful`), { params: Promise.resolve({ id: review.id }) });
    expect((await body(first)).helpfulCount).toBe(review.helpfulCount + 1);
    const again = await helpful.POST(send("POST", `/api/reviews/${review.id}/helpful`), { params: Promise.resolve({ id: review.id }) });
    expect((await body(again)).helpfulCount).toBe(review.helpfulCount + 1);
    const missing = await helpful.POST(send("POST", "/x"), { params: Promise.resolve({ id: "rev_nope" }) });
    expect(missing.status).toBe(404);
  });
});

describe("uploads", () => {
  it("rejects anonymous visitors and customers, accepts staff", async () => {
    expect((await uploadsRoute.POST(multipart("file", PNG, "image/png"))).status).toBe(401);
    await signInWithPassword({ email: "customer@apexline.example", password: SEED_CREDENTIALS.customer.password });
    expect((await uploadsRoute.POST(multipart("file", PNG, "image/png"))).status).toBe(403);
    scope.jar.clear();
    await signInStaff({ email: SEED_CREDENTIALS.staff.email, password: SEED_CREDENTIALS.staff.password });
    const res = await uploadsRoute.POST(multipart("file", PNG, "image/png", "../../evil.php"));
    expect(res.status).toBe(201);
    const saved = await body(res);
    expect(saved).toMatchObject({ type: "image/png", size: PNG.byteLength });
    expect(saved.url).toMatch(/^\/uploads\/[A-Za-z0-9_-]{16}\.png$/); // random name: the client's file name is ignored
    expect(fs.existsSync(`${uploadDir()}/${saved.name}`)).toBe(true);
    expect(await db.auditLog.findOne((a) => a.action === "upload.create")).toBeTruthy();

    // served back with locked-down headers
    const served = await uploadsServe.GET(get(saved.url), { params: Promise.resolve({ path: [saved.name] }) });
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/png");
    expect(served.headers.get("content-security-policy")).toContain("sandbox");
    expect(served.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(PNG);
  });

  it("validates by content, not by the declared type", async () => {
    await signInStaff({ email: SEED_CREDENTIALS.staff.email, password: SEED_CREDENTIALS.staff.password });
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>".padEnd(40, " "));
    expect((await uploadsRoute.POST(multipart("file", html, "image/png", "x.png"))).status).toBe(415);
    const exe = Uint8Array.from([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0, 0xff, 0xff]);
    expect((await uploadsRoute.POST(multipart("file", exe, "image/jpeg", "x.jpg"))).status).toBe(415);
    const evilSvg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect(await body(await uploadsRoute.POST(multipart("file", evilSvg, "image/svg+xml", "x.svg")))).toEqual({ error: "file_type_not_allowed" });
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(PNG);
    expect((await uploadsRoute.POST(multipart("file", big, "image/png", "big.png"))).status).toBe(413);
    expect((await uploadsRoute.POST(multipart("file", new Uint8Array(0), "image/png", "empty.png"))).status).toBe(415);
    expect((await uploadsRoute.POST(send("POST", "/api/uploads", { file: "x" }))).status).toBe(415);
    expect((await uploadsRoute.POST(multipart("file", PNG, "image/png", "x.png", { origin: "https://evil.example" }))).status).toBe(403);
    const form = new FormData();
    form.set("other", "x");
    expect((await uploadsRoute.POST(new Request(url("/api/uploads"), { method: "POST", body: form, headers: { origin: ORIGIN } }))).status).toBe(400);
    const clean = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4" fill="#ff5a1f"/></svg>');
    expect((await uploadsRoute.POST(multipart("file", clean, "image/svg+xml", "logo.svg"))).status).toBe(201);
  });

  it("content sniffing and SVG screening", async () => {
    expect(detectImageType(PNG)).toBe("image/png");
    expect(detectImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1]))).toBe("image/jpeg");
    expect(detectImageType(new TextEncoder().encode("RIFF1234WEBPVP8 "))).toBe("image/webp");
    expect(detectImageType(new TextEncoder().encode("\0\0\0\x1cftypavif\0\0\0\0"))).toBe("image/avif");
    expect(detectImageType(new TextEncoder().encode("GIF89a......."))).toBeNull();
    expect(detectImageType(new TextEncoder().encode("%PDF-1.7 ......"))).toBeNull();
    for (const evil of [
      "<svg><script>1</script></svg>",
      '<svg onload="alert(1)"/>',
      '<svg><a href="javascript:alert(1)"><text>x</text></a></svg>',
      "<svg><foreignObject><div/></foreignObject></svg>",
      '<svg><image href="https://evil.example/x.png"/></svg>',
      '<svg><use xlink:href="data:image/svg+xml;base64,AAAA"/></svg>',
      '<!DOCTYPE svg [<!ENTITY a "b">]><svg/>',
    ]) {
      expect(isSafeSvg(evil), evil).toBe(false);
    }
    expect(isSafeSvg('<svg><defs><linearGradient id="g"/></defs><rect fill="url(#g)"/><use href="#g"/></svg>')).toBe(true);
    // serving: only files we wrote
    for (const name of ["../package.json", "..%2fpackage.json", "a/b.png", "x.php", ".env", "noext", "x.png.exe"]) expect(await readUpload(name), name).toBeNull();
    expect((await saveImageUpload(PNG)).url.startsWith("/uploads/")).toBe(true);
    const missing = await uploadsServe.GET(get("/uploads/nothing12.png"), { params: Promise.resolve({ path: ["nothing12.png"] }) });
    expect(missing.status).toBe(404);
    expect((await uploadsServe.GET(get("/uploads/a/b"), { params: Promise.resolve({ path: ["a", "b"] }) })).status).toBe(404);
  });
});

describe("admin export / import", () => {
  it("exports CSV for staff only, with a BOM and an audit trail", async () => {
    expect((await exportOrders.GET(get("/api/admin/export/orders"))).status).toBe(401);
    await signInWithPassword({ email: "customer@apexline.example", password: SEED_CREDENTIALS.customer.password });
    expect((await exportOrders.GET(get("/api/admin/export/orders"))).status).toBe(403);
    scope.jar.clear();
    await signInStaff({ email: SEED_CREDENTIALS.staff.email, password: SEED_CREDENTIALS.staff.password });

    const res = await exportOrders.GET(get("/api/admin/export/orders?status=processing"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="orders-\d{4}-\d{2}-\d{2}\.csv"$/);
    const raw = await res.clone().arrayBuffer();
    expect([...new Uint8Array(raw.slice(0, 3))]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM so Excel reads Turkish text
    const text = await res.text(); // text() strips the BOM
    expect(text.startsWith("number,created_at")).toBe(true);
    const rows = text.trim().split("\r\n");
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.slice(1).every((r) => r.includes(",processing,"))).toBe(true);
    expect((await exportOrders.GET(get("/api/admin/export/orders?status=weird"))).status).toBe(400);

    expect((await (await exportProducts.GET()).text()).split("\r\n").length).toBeGreaterThan(100);
    expect((await (await exportSubscribers.GET()).text()).startsWith("email,locale")).toBe(true);
    const actions = (await db.auditLog.find({ where: (a) => a.action.startsWith("export.") })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["export.orders", "export.products", "export.subscribers"]));
  });

  it("imports CSV (raw body or multipart), supports dry runs and reports row errors", async () => {
    const csv = "slug,status,name_en,summary_en,brand,category,part_number,sku,price,stock\r\nroute-import-part,active,Route Import Part,Summary,apexline-select,brake-pads,RIP-1,RIP-SKU-1,19.90,5\r\nbad-row,active,Bad,Summary,nobrand,brake-pads,RIP-2,RIP-SKU-2,1,1\r\n";
    const asText = (path: string) => new Request(url(path), { method: "POST", body: csv, headers: { origin: ORIGIN, "content-type": "text/csv" } });
    expect((await importProducts.POST(asText("/api/admin/import/products"))).status).toBe(401);
    await signInStaff({ email: SEED_CREDENTIALS.staff.email, password: SEED_CREDENTIALS.staff.password });

    const dry = await body(await importProducts.POST(asText("/api/admin/import/products?dryRun=1")));
    expect(dry).toMatchObject({ created: 1, skipped: 1 });
    expect(await db.variants.findOne((v) => v.sku === "RIP-SKU-1")).toBeNull();

    const real = await body(await importProducts.POST(asText("/api/admin/import/products")));
    expect(real).toMatchObject({ created: 1, skipped: 1, errors: [{ row: 3 }] });
    expect(await db.variants.findOne((v) => v.sku === "RIP-SKU-1")).toMatchObject({ price: 1990, stockOnHand: 5 });

    const form = new FormData();
    form.set("file", new File([csv.replace("19.90", "21.50")], "p.csv", { type: "text/csv" }));
    const viaForm = await importProducts.POST(new Request(url("/api/admin/import/products"), { method: "POST", body: form, headers: { origin: ORIGIN } }));
    expect(await body(viaForm)).toMatchObject({ updated: 1, created: 0 });
    expect(await db.variants.findOne((v) => v.sku === "RIP-SKU-1")).toMatchObject({ price: 2150 });

    expect((await importProducts.POST(new Request(url("/api/admin/import/products"), { method: "POST", body: "{}", headers: { origin: ORIGIN, "content-type": "application/json" } }))).status).toBe(415);
    expect((await importProducts.POST(new Request(url("/api/admin/import/products"), { method: "POST", body: "only,one,line", headers: { origin: ORIGIN, "content-type": "text/csv" } }))).status).toBe(400);
  });
});

describe("payment webhooks", () => {
  const post = (payload: unknown, signature?: string | null) => {
    const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
    const headers: Record<string, string> = {};
    if (signature !== null) headers["x-apexline-signature"] = signature ?? signWebhookPayload(raw);
    return webhook.POST(new Request(url("/api/webhooks/payments"), { method: "POST", body: raw, headers }));
  };

  async function pendingThreeDs() {
    const c = await cart.getOrCreateCart({});
    const v = (await db.variants.find({ where: (x) => x.isActive && x.stockOnHand - x.stockReserved > 10 }))[5]!;
    await cart.addItem(c.id, v.id, 1);
    const result = await checkout.placeOrder({ cartId: c.id, email: "late@example.com", shippingAddress: US_ADDRESS, shippingMethodId: "shp_standard", locale: "en", idempotencyKey: randomUUID(), payment: { type: "card", card: { ...CARD_OK, number: "4000 0025 0000 3155" } } });
    if (result.status !== "requires_action") throw new Error("expected requires_action");
    const payment = (await db.payments.findOne((p) => p.orderId === result.order.id))!;
    return { order: result.order, payment, variant: v };
  }

  it("rejects unsigned, tampered and stale deliveries", async () => {
    const payload = { type: "payment.succeeded", providerRef: "mock_pi_x" };
    expect((await post(payload, null)).status).toBe(400);
    expect((await post(payload, "t=1,v1=deadbeef")).status).toBe(400);
    const raw = JSON.stringify(payload);
    const sig = signWebhookPayload(raw);
    expect((await post(raw + " ", sig)).status).toBe(400);
    expect((await post(raw, signWebhookPayload(raw, process.env.PAYMENT_WEBHOOK_SECRET, new Date(Date.now() - 3_600_000)))).status).toBe(400);
    expect(await body(await post(payload, null))).toEqual({ error: "invalid_token" });
  });

  it("a late success webhook completes a pending 3-D-Secure order exactly once", async () => {
    const { order, payment, variant } = await pendingThreeDs();
    const before = (await db.variants.get(variant.id))!;
    const res = await post({ type: "payment.succeeded", providerRef: payment.providerRef });
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ received: true, result: "applied" });
    expect(await db.orders.get(order.id)).toMatchObject({ status: "processing", paymentStatus: "paid" });
    const after = (await db.variants.get(variant.id))!;
    expect(after.stockOnHand).toBe(before.stockOnHand - 1);
    expect(after.stockReserved).toBe(before.stockReserved - 1);
    // replay
    expect(await body(await post({ type: "payment.succeeded", providerRef: payment.providerRef }))).toEqual({ received: true, result: "ignored" });
    expect((await db.variants.get(variant.id))!.stockOnHand).toBe(after.stockOnHand);
  });

  it("failure webhooks release the hold; success for a cancelled order is flagged for review", async () => {
    const a = await pendingThreeDs();
    const held = (await db.variants.get(a.variant.id))!.stockReserved;
    expect(await body(await post({ type: "payment.failed", providerRef: a.payment.providerRef, code: "card_declined" }))).toEqual({ received: true, result: "applied" });
    expect(await db.orders.get(a.order.id)).toMatchObject({ paymentStatus: "failed", status: "pending_payment" });
    expect((await db.variants.get(a.variant.id))!.stockReserved).toBe(held - 1);

    const b = await pendingThreeDs();
    await db.orders.update(b.order.id, { createdAt: new Date(Date.now() - 3_600_000).toISOString(), updatedAt: new Date(Date.now() - 3_600_000).toISOString() });
    const { releaseExpiredReservations } = await import("@/lib/services/inventory");
    await releaseExpiredReservations();
    expect((await db.orders.get(b.order.id))!.status).toBe("cancelled");
    expect(await body(await post({ type: "payment.succeeded", providerRef: b.payment.providerRef }))).toEqual({ received: true, result: "needs_review" });
    expect((await db.orders.get(b.order.id))!.paymentStatus).not.toBe("paid");
    expect(await db.auditLog.findOne((x) => x.action === "payment.orphaned" && x.entityId === b.order.id)).toBeTruthy();

    expect(await body(await post({ type: "payment.succeeded", providerRef: "mock_pi_unknown" }))).toEqual({ received: true, result: "ignored" });
    expect(await body(await post({ type: "refund.succeeded", providerRef: a.payment.providerRef }))).toEqual({ received: true, result: "ignored" });
  });
});

describe("auth route", () => {
  it("serves Better Auth endpoints (session lookup for a signed-out visitor)", async () => {
    const res = await authRoute.GET(new Request(url("/api/auth/get-session"), { headers: { origin: ORIGIN } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
    expect(getAuth()).toBe(getAuth()); // shared instance
  });
});

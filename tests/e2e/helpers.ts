import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

export const ADMIN = { email: "admin@apexline.example", password: "Admin#Apex2026!" };
export const CUSTOMER = { email: "customer@apexline.example", password: "Customer#Apex2026!" };

/** Product used by the purchase flows (seeded, single default variant "Front axle"). */
export const PRODUCT_SLUG = "torqvane-proceram-ceramic-brake-pad-set";

export const CARDS = {
  ok: "4242424242424242",
  declined: "4000000000000002",
} as const;

/** Reads a collection straight from the isolated JSON "database" of this run (the server writes through on every commit). */
export function readCollection<T = Record<string, unknown>>(name: string): T[] {
  const dir = process.env.E2E_DATA_DIR;
  if (!dir) throw new Error("E2E_DATA_DIR is not set (run through playwright.config.ts)");
  return JSON.parse(readFileSync(path.join(dir, `${name}.json`), "utf8")) as T[];
}

export interface VariantRow {
  id: string;
  productId: string;
  stockOnHand: number;
  stockReserved: number;
  isDefault?: boolean;
}

/** Stock of the default variant of a product, looked up by slug. */
export function stockOf(slug: string): { id: string; onHand: number; reserved: number } {
  const product = readCollection<{ id: string; slug: string }>("products").find((p) => p.slug === slug);
  if (!product) throw new Error(`product ${slug} not found in the data directory`);
  const variants = readCollection<VariantRow>("variants").filter((v) => v.productId === product.id);
  const variant = variants.find((v) => v.isDefault) ?? variants[0]!;
  return { id: variant.id, onHand: variant.stockOnHand, reserved: variant.stockReserved };
}

/** Adds the product to the cart from its detail page (the cart drawer opens on success). */
export async function addToCart(page: Page, slug: string = PRODUCT_SLUG): Promise<void> {
  await page.goto(`/en/product/${slug}`);
  await page.getByRole("button", { name: /add to cart/i }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

/** Fills contact + shipping address, picks the first shipping method and fills the card form. Does not submit. */
export async function fillCheckout(page: Page, opts: { email: string; card: string; coupon?: string }): Promise<void> {
  await page.goto("/en/checkout");
  await page.getByLabel(/email address/i).fill(opts.email);
  await page.getByLabel(/first name/i).first().fill("Test");
  await page.getByLabel(/last name/i).first().fill("Driver");
  await page.getByLabel(/^address/i).first().fill("100 Main St");
  await page.getByLabel(/country/i).first().selectOption({ label: "United States" });
  await page.getByLabel(/city/i).first().fill("Detroit");
  const region = page.getByLabel(/state|region|province/i).first();
  if (await region.count()) {
    if ((await region.evaluate((el) => el.tagName)) === "SELECT") await region.selectOption({ index: 1 });
    else await region.fill("MI");
  }
  await page.getByLabel(/zip|postal/i).first().fill("48201");
  const phone = page.getByLabel(/phone/i).first();
  if (await phone.count()) await phone.fill("+1 313 555 0111");

  await page.getByRole("radio").first().check();
  if (opts.coupon) {
    await page.getByLabel(/discount code/i).filter({ visible: true }).first().fill(opts.coupon);
    await page.getByRole("button", { name: /^apply$/i }).click();
  }
  await page.getByLabel(/name on card/i).fill("Test Driver");
  await page.getByLabel(/card number/i).fill(opts.card);
  await page.getByLabel(/expiry/i).fill("12 / 34");
  await page.getByLabel(/security code/i).fill("123");
  await page.getByRole("checkbox", { name: /terms/i }).check();
}

export async function submitPayment(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^pay /i }).click();
}

/** Places a guest order with the approved mock card and returns its number (e.g. AX-10042). */
export async function placeGuestOrder(page: Page, email = "guest@example.com"): Promise<string> {
  await addToCart(page);
  await fillCheckout(page, { email, card: CARDS.ok });
  await submitPayment(page);
  await expect(page).toHaveURL(/\/en\/checkout\/confirmation\/AX-\d+/, { timeout: 30_000 });
  const number = /(AX-\d+)/.exec(page.url())?.[1];
  if (!number) throw new Error(`order number missing from ${page.url()}`);
  return number;
}

/** Signs in through the shared admin login form. */
export async function adminLogin(page: Page, who: { email: string; password: string } = ADMIN): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(who.email);
  await page.getByLabel(/password/i).fill(who.password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
}

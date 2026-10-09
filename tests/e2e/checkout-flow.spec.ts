import { expect, test } from "@playwright/test";
import { addToCart, CARDS, fillCheckout, PRODUCT_SLUG, readCollection, stockOf, submitPayment } from "./helpers";

test.describe("guest checkout", () => {
  test("browse -> cart -> pay with the mock card -> confirmation", async ({ page }) => {
    // browse: home -> category -> product (rather than deep-linking straight to the product)
    await page.goto("/en");
    await page.goto("/en/category/brakes");
    await expect(page.getByRole("heading", { level: 1, name: /brakes/i })).toBeVisible();
    await page.locator(`a[href*="/product/${PRODUCT_SLUG}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/product/${PRODUCT_SLUG}`));

    const before = stockOf(PRODUCT_SLUG);
    await page.getByRole("button", { name: /add to cart/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("button", { name: /open cart, 1 item/i })).toBeVisible();

    await fillCheckout(page, { email: "guest@example.com", card: CARDS.ok });
    await submitPayment(page);

    await expect(page).toHaveURL(/\/en\/checkout\/confirmation\/AX-\d+/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /your order is in/i })).toBeVisible();

    // persisted to the JSON store: a paid order and the stock committed (on-hand drops by the quantity bought)
    const number = /(AX-\d+)/.exec(page.url())![1]!;
    const order = readCollection<{ number: string; paymentStatus: string; status: string }>("orders").find((o) => o.number === number);
    expect(order).toMatchObject({ paymentStatus: "paid", status: "processing" });
    const after = stockOf(PRODUCT_SLUG);
    expect(after.onHand).toBe(before.onHand - 1);
  });

  test("a declined card shows an error, charges nothing and keeps the cart", async ({ page }) => {
    await addToCart(page);
    const before = stockOf(PRODUCT_SLUG);
    const ordersBefore = readCollection<{ paymentStatus: string }>("orders").filter((o) => o.paymentStatus === "paid").length;

    await fillCheckout(page, { email: "declined@example.com", card: CARDS.declined });
    await submitPayment(page);

    await expect(page.getByText(/card was declined/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/en\/checkout$/);
    await expect(page.getByText(/nothing was charged/i).first()).toBeVisible();

    // no new paid order, and committed stock did not change
    expect(readCollection<{ paymentStatus: string }>("orders").filter((o) => o.paymentStatus === "paid")).toHaveLength(ordersBefore);
    expect(stockOf(PRODUCT_SLUG).onHand).toBe(before.onHand);

    // the shopper can retry with a good card on the same checkout and succeed
    await page.getByLabel(/card number/i).fill(CARDS.ok);
    await page.getByLabel(/expiry/i).fill("12 / 34");
    await page.getByLabel(/security code/i).fill("123");
    await submitPayment(page);
    await expect(page).toHaveURL(/\/en\/checkout\/confirmation\/AX-\d+/, { timeout: 30_000 });
  });

  test("a discount code is validated, shown in the summary and stored on the order", async ({ page }) => {
    await addToCart(page);
    await page.goto("/en/checkout");

    // an unknown code is rejected with an explanation
    await page.getByLabel(/discount code/i).filter({ visible: true }).first().fill("NOPE-NOT-A-CODE");
    await page.getByRole("button", { name: /^apply$/i }).click();
    await expect(page.getByText(/coupon code is not valid/i).first()).toBeVisible();

    // a real seeded code (10% off first order) is applied and priced server-side
    await fillCheckout(page, { email: "coupon@example.com", card: CARDS.ok, coupon: "WELCOME10" });
    await expect(page.getByText(/code WELCOME10 applied/i).locator("visible=true").first()).toBeVisible();
    await expect(page.getByText(/discount \(WELCOME10\)/i).locator("visible=true").first()).toBeVisible();

    await submitPayment(page);
    await expect(page).toHaveURL(/\/en\/checkout\/confirmation\/AX-\d+/, { timeout: 30_000 });
    const number = /(AX-\d+)/.exec(page.url())![1]!;
    const order = readCollection<{ number: string; couponCode?: string; discount: number; subtotal: number }>("orders").find((o) => o.number === number)!;
    expect(order.couponCode).toBe("WELCOME10");
    expect(order.discount).toBe(Math.round(order.subtotal * 0.1));
  });
});

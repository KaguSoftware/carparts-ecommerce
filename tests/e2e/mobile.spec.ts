import { expect, test } from "@playwright/test";
import { PRODUCT_SLUG } from "./helpers";

test.describe("mobile layout", () => {
  test("@mobile key pages do not scroll horizontally at 360px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    for (const path of ["/en", "/en/shop", "/en/category/brakes", `/en/product/${PRODUCT_SLUG}`, "/en/cart", "/en/pages/shipping", "/tr/shop"]) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
    }
  });

  test("@mobile add to cart works from the product page", async ({ page }) => {
    await page.goto(`/en/product/${PRODUCT_SLUG}`);
    await page.getByRole("button", { name: /add to cart/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

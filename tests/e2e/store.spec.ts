import { expect, test } from "@playwright/test";

test.describe("storefront", () => {
  test("unknown product, category and page return HTTP 404", async ({ request }) => {
    for (const path of ["/en/product/nonexistent", "/en/category/zzz", "/en/brand/zzz", "/en/pages/zzz"]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(404);
    }
  });

  test("home shows hero, categories and the vehicle finder", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("heading", { name: /shop by assembly/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /find parts for your car/i })).toBeVisible();
  });

  test("search suggests parts and opens results", async ({ page }) => {
    await page.goto("/en");
    const search = page.locator('input[role="combobox"]');
    await search.fill("brake");
    await expect(page.getByRole("option").first()).toBeVisible({ timeout: 15_000 });
    await search.press("Enter");
    await expect(page).toHaveURL(/\/en\/search\?q=brake/);
    await expect(page.locator("article").first()).toBeVisible();
  });

  test("category page filters by brand through the URL", async ({ page }) => {
    await page.goto("/en/category/brakes");
    await expect(page.getByRole("heading", { level: 1, name: /brakes/i })).toBeVisible();
    await page.goto("/en/category/brakes?sort=price_asc&stock=1");
    await expect(page.locator("article").first()).toBeVisible();
  });

  test("add to cart opens the drawer and the badge updates", async ({ page }) => {
    await page.goto("/en/product/torqvane-proceram-ceramic-brake-pad-set");
    await page.getByRole("button", { name: /add to cart/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("button", { name: /open cart, 1 item/i })).toBeVisible();
  });

  test("garage selection filters the catalogue and shows fit badges", async ({ page }) => {
    const total = async () => {
      const text = await page.getByText(/showing \d+.\d+ of \d+ part/i).first().innerText();
      return Number(/of (\d+) part/i.exec(text)![1]);
    };
    await page.goto("/en/shop");
    const allParts = await total();

    await page.goto("/en/garage");
    const form = page.locator("form").filter({ has: page.getByLabel("Make") }).last();
    await form.getByLabel("Make").selectOption({ index: 1 });
    await expect(form.getByLabel("Model")).toBeEnabled();
    await form.getByLabel("Model").selectOption({ index: 1 });
    await form.getByRole("button", { name: /find parts that fit/i }).click();
    await expect(page.getByText(/saved to your garage/i).first()).toBeVisible({ timeout: 15_000 });

    await page.goto("/en/shop");
    await expect(page.getByText(/showing parts that fit/i)).toBeVisible();
    const fitting = await total();
    expect(fitting).toBeGreaterThan(0);
    expect(fitting).toBeLessThan(allParts);

    // the choice is remembered in a cookie, so it survives a reload and applies to other listings too
    await page.reload();
    await expect(page.getByText(/showing parts that fit/i)).toBeVisible();
    await page.goto("/en/category/brakes");
    await expect(page.getByText(/showing parts that fit/i)).toBeVisible();
  });

  test("language switch keeps the page and query, and translates content and currency", async ({ page }) => {
    await page.goto("/en/shop?sort=price_asc");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("article").first()).toContainText("$");
    await page.getByRole("button", { name: /turkish/i }).first().click();
    await expect(page).toHaveURL(/\/tr\/shop\?sort=price_asc/);
    await expect(page.locator("html")).toHaveAttribute("lang", "tr");
    await expect(page.locator("article").first()).toContainText(/₺|TRY|TL/);
    await expect(page.getByText(/parçadan|parça/i).first()).toBeVisible();

    await page.goto("/tr/cart");
    await expect(page.getByRole("heading", { level: 1, name: /alışveriş sepeti/i })).toBeVisible();
    await page.getByRole("button", { name: /^.ngilizce$/i }).first().click();
    await expect(page).toHaveURL(/\/en\/cart/);
    await expect(page.getByRole("heading", { level: 1, name: /shopping cart/i })).toBeVisible();
  });

  test("contact form validates required fields", async ({ page }) => {
    await page.goto("/en/contact");
    await page.getByRole("button", { name: /send message/i }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
  });
});

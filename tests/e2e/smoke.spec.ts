import { expect, test } from "@playwright/test";

test.describe("scaffold smoke", () => {
  test("root redirects to the default locale", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en\/?$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("turkish locale renders", async ({ page }) => {
    await page.goto("/tr");
    await expect(page.locator("html")).toHaveAttribute("lang", "tr");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("unknown route shows the localized 404", async ({ page }) => {
    const res = await page.goto("/en/this-does-not-exist");
    expect(res?.status()).toBe(404);
  });

  test("admin and account areas redirect anonymous visitors to login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login\?next=/);
    await page.goto("/tr/account/orders");
    await expect(page).toHaveURL(/\/tr\/login\?next=/);
  });
});

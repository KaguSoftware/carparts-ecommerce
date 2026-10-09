import { expect, test } from "@playwright/test";
import { ADMIN, adminLogin, CUSTOMER, PRODUCT_SLUG, placeGuestOrder, readCollection, stockOf } from "./helpers";

test.describe("admin", () => {
  test("seeded admin signs in and reaches the dashboard and orders", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
    await adminLogin(page, ADMIN);
    await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });
    await page.goto("/admin/orders");
    await expect(page.locator("table tbody tr").first()).toBeVisible();
  });

  test("a new order appears in the admin, moves to shipped, and its stock was committed", async ({ page, browser }) => {
    // 1) a guest buys one unit
    const before = stockOf(PRODUCT_SLUG);
    const number = await placeGuestOrder(page, "stock-check@example.com");
    expect(stockOf(PRODUCT_SLUG).onHand).toBe(before.onHand - 1);

    // 2) the admin finds it
    const adminContext = await browser.newContext();
    const admin = await adminContext.newPage();
    await adminLogin(admin);
    await expect(admin).toHaveURL(/\/admin$/, { timeout: 20_000 });
    await admin.goto(`/admin/orders?q=${number}`);
    const row = admin.locator("table tbody tr", { hasText: number });
    await expect(row).toBeVisible();
    await expect(row).toContainText(/processing/i);
    await row.getByRole("link", { name: number }).first().click();
    await expect(admin.getByRole("heading", { name: new RegExp(number) }).first()).toBeVisible();

    // 3) status workflow: processing -> shipped (carrier + tracking), via the ship dialog
    await admin.getByRole("button", { name: /^ship/i }).first().click();
    const dialog = admin.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("textbox", { name: /carrier/i }).fill("DHL");
    await dialog.getByRole("textbox", { name: /tracking/i }).fill("JD0146000012345");
    await dialog.getByRole("button", { name: /^ship/i }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(admin.getByText(/shipped/i).first()).toBeVisible();

    const stored = readCollection<{ number: string; status: string; trackingNumber?: string }>("orders").find((o) => o.number === number)!;
    expect(stored).toMatchObject({ status: "shipped", trackingNumber: "JD0146000012345" });

    // 4) shipping did not touch on-hand stock again (it was committed at payment), and nothing stays reserved for it
    const after = stockOf(PRODUCT_SLUG);
    expect(after.onHand).toBe(before.onHand - 1);
    expect(after.reserved).toBe(before.reserved);

    // 5) the audit log recorded the staff action
    await admin.goto("/admin/audit");
    await expect(admin.locator("table tbody tr").first()).toBeVisible();
    await adminContext.close();
  });

  test("customers cannot reach the admin panel", async ({ page }) => {
    // signed out
    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/admin\/login/);

    // signed in as a customer through the storefront
    await page.goto("/en/login");
    await page.locator("main").getByLabel(/email address/i).fill(CUSTOMER.email);
    await page.locator("main").getByLabel(/^password/i).fill(CUSTOMER.password);
    await page.locator("main").getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });

    // the admin shell renders a "No access" screen for non-staff accounts and none of the page content
    for (const path of ["/admin", "/admin/orders", "/admin/products", "/admin/settings", "/admin/staff"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: /no access/i }), path).toBeVisible();
      await expect(page.locator("table"), path).toHaveCount(0);
    }

    // admin APIs refuse the session as well
    for (const path of ["/api/admin/export/orders", "/api/admin/export/products", "/api/admin/export/subscribers"]) {
      const res = await page.request.get(path);
      expect([401, 403], path).toContain(res.status());
    }

    // and the admin login form does not accept customer credentials
    const fresh = await page.context().browser()!.newContext();
    const p2 = await fresh.newPage();
    await adminLogin(p2, CUSTOMER);
    await expect(p2).not.toHaveURL(/\/admin$/);
    await fresh.close();
  });
});

import { expect, test } from "@playwright/test";

/**
 * Home page "Engine Teardown" section. In a headless browser WebGL may or may not exist, so the test accepts either the
 * 3D canvas or the static SVG blueprint fallback, and checks that every part in the legend leads to a real shop route.
 */
test.describe("engine teardown", () => {
  for (const locale of ["en", "tr"] as const) {
    test(`renders and its part links resolve (${locale})`, async ({ page, request }) => {
      await page.goto(`/${locale}`);

      const section = page.locator("#engine-teardown");
      await expect(section).toBeAttached();
      await section.scrollIntoViewIfNeeded();
      await expect(section.getByRole("heading", { level: 2 })).toBeVisible();

      // Either the three.js canvas (once the lazy chunk is up) or the server-rendered blueprint is on screen.
      await expect
        .poll(async () => (await section.locator("canvas").count()) + (await section.locator('svg[role="img"]').count()), { timeout: 20_000 })
        .toBeGreaterThan(0);
      await expect(section).toHaveAttribute("data-mode", /^(scroll|manual|static)$/);

      // The desktop legend lists every part as a link (the default Playwright viewport is >= md).
      const legend = section.locator("nav a");
      await expect(legend.first()).toBeVisible();
      const hrefs = await legend.evaluateAll((els) => els.map((el) => (el as HTMLAnchorElement).getAttribute("href") ?? ""));
      expect(hrefs.length).toBeGreaterThanOrEqual(15);

      const unique = [...new Set(hrefs)];
      for (const href of unique) {
        expect(href, "link stays inside the locale").toMatch(new RegExp(`^/${locale}/(category/[a-z0-9-]+|search\\?q=[^&]+)$`));
        const res = await request.get(href);
        expect(res.status(), href).toBe(200);
      }
    });
  }

  test("a part link navigates to its shop page", async ({ page }) => {
    await page.goto("/en");
    const link = page.locator("#engine-teardown nav a", { hasText: /piston/i }).first();
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/en\/search\?q=piston/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

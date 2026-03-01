import { expect, test } from "@playwright/test";

test("dashboard loads", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator('a[href="/dashboard"]')).toBeVisible();
});

test("dashboard key area screenshot", async ({ page }) => {
  await page.goto("/dashboard");
  await page.locator("main").screenshot({ path: "test-results/dashboard-main.png" });
});

import { expect, test } from "@playwright/test";

test("settings loads", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator('a[href="/settings"]')).toBeVisible();
});

test("settings key area screenshot", async ({ page }) => {
  await page.goto("/settings");
  await page.locator("main").screenshot({ path: "test-results/settings-main.png" });
});

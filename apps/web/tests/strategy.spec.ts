import { expect, test } from "@playwright/test";

test("strategy loads", async ({ page }) => {
  await page.goto("/strategy");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator('a[href="/strategy"]')).toBeVisible();
});

test("strategy key area screenshot", async ({ page }) => {
  await page.goto("/strategy");
  await page.locator("main").screenshot({ path: "test-results/strategy-main.png" });
});

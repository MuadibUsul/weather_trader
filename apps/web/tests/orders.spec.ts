import { expect, test } from "@playwright/test";

test("orders loads", async ({ page }) => {
  await page.goto("/orders");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator('a[href="/orders"]')).toBeVisible();
  await expect(page.locator("table").first()).toBeVisible();
});

test("orders key area screenshot", async ({ page }) => {
  await page.goto("/orders");
  await page.locator("main").screenshot({ path: "test-results/orders-main.png" });
});

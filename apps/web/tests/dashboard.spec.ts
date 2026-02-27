import { expect, test } from "@playwright/test";

test("dashboard loads", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByText("Weather Trader")).toBeVisible();
  await expect(page.getByText("温度桶合约 (NYC)")).toBeVisible();
});

test("dashboard key area screenshot", async ({ page }) => {
  await page.goto("/dashboard");
  await page.locator("main").screenshot({ path: "test-results/dashboard-main.png" });
});

import { expect, test } from "@playwright/test";

test("strategy loads", async ({ page }) => {
  await page.goto("/strategy");
  await expect(page.getByText("策略与风控配置")).toBeVisible();
});

test("strategy key area screenshot", async ({ page }) => {
  await page.goto("/strategy");
  await page.locator("main").screenshot({ path: "test-results/strategy-main.png" });
});

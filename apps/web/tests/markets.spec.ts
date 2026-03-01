import { expect, test } from "@playwright/test";

test("markets loads", async ({ page }) => {
  await page.goto("/markets");
  await expect(page.getByText("所有合约列表")).toBeVisible();
});

test("markets key area screenshot", async ({ page }) => {
  await page.goto("/markets");
  await page.locator("main").screenshot({ path: "test-results/markets-main.png" });
});

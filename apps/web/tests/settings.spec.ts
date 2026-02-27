import { expect, test } from "@playwright/test";

test("settings loads", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByText("用户设置与安全")).toBeVisible();
});

test("settings key area screenshot", async ({ page }) => {
  await page.goto("/settings");
  await page.locator("main").screenshot({ path: "test-results/settings-main.png" });
});

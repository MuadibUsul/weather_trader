import { expect, test } from "@playwright/test";

test("orders loads", async ({ page }) => {
  await page.goto("/orders");
  await expect(page.getByText("订单 ID")).toBeVisible();
});

test("orders key area screenshot", async ({ page }) => {
  await page.goto("/orders");
  await page.locator("main").screenshot({ path: "test-results/orders-main.png" });
});

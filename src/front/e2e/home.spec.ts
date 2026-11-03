import { expect, test } from "@playwright/test";

test("the home page shows the application name", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "AeroSafe" })).toBeVisible();
});

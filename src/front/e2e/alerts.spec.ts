import { expect, test } from "@playwright/test";

test("the alerts page asks for a Supervisor login", async ({ page }) => {
  await page.goto("/alerts");

  await expect(page.getByRole("heading", { name: "Alerts" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Log in as a Supervisor");
});

test("the rules page asks for a Supervisor login", async ({ page }) => {
  await page.goto("/rules");

  await expect(page.getByRole("heading", { name: "Rules" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Log in as a Supervisor");
});

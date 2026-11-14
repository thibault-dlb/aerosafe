import { expect, test } from "@playwright/test";

import { emptyData, openSession } from "./session";

for (const path of ["/alerts", "/rules"]) {
  test(`${path} sends a visitor who is not logged in to the log in screen`, async ({ page }) => {
    await page.goto(path);

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { level: 1, name: "Bon retour" })).toBeVisible();
  });

  test(`${path} is closed to a User`, async ({ page }) => {
    await openSession(page, "USER");
    await emptyData(page);

    await page.goto(path);

    await expect(page.getByRole("heading", { name: "Accès réservé" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  });
}

test("the alerts page opens for a Supervisor", async ({ page }) => {
  await openSession(page, "SUPERVISOR");
  await emptyData(page);

  await page.goto("/alerts");

  await expect(page.getByRole("heading", { name: "Alerts" })).toBeVisible();
});

test("the rules page opens for a Supervisor", async ({ page }) => {
  await openSession(page, "SUPERVISOR");
  await emptyData(page);

  await page.goto("/rules");

  await expect(page.getByRole("heading", { name: "Rules" })).toBeVisible();
});

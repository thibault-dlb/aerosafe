import { expect, test } from "@playwright/test";

import { emptyData, openSession } from "./session";

test("a User finds the dashboard and the aircraft in the side bar, and nothing of the supervision", async ({ page }) => {
  await openSession(page, "USER");
  await emptyData(page);

  await page.goto("/dashboard");

  const menu = page.getByRole("navigation", { name: "Navigation principale" });
  await expect(menu.getByRole("link", { name: "Tableau de bord" })).toHaveAttribute("aria-current", "page");
  await expect(menu.getByRole("link", { name: "Aéronefs" })).toBeVisible();
  await expect(menu.getByRole("link", { name: /Alertes/ })).toHaveCount(0);
  await expect(page.getByText("Supervision", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Compte" })).toContainText("Utilisateur");
});

test("a Supervisor also gets the supervision pages, with the number of active alerts", async ({ page }) => {
  await openSession(page, "SUPERVISOR");
  await emptyData(page);
  await page.route("**/api/v1/alerts**", (route) => route.fulfill({ json: { items: [], total: 4 } }));

  await page.goto("/dashboard");

  const menu = page.getByRole("navigation", { name: "Navigation principale" });
  for (const name of ["Alertes", "Règles", "Comptes"]) {
    await expect(menu.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  }
  await expect(menu.getByRole("link", { name: /Alertes/ })).toContainText("4 actives");
  await expect(page.getByRole("group", { name: "Compte" })).toContainText("Superviseur");

  await menu.getByRole("link", { name: /Règles/ }).click();
  await expect(page).toHaveURL(/\/rules$/);
  await expect(page.getByRole("banner")).toContainText("Règles");
});

test("the side bar folds into a rail of icons, and stays folded after a reload", async ({ page }) => {
  await openSession(page);
  await emptyData(page);
  await page.goto("/dashboard");
  const side = page.getByRole("complementary");
  await expect.poll(async () => (await side.boundingBox())?.width).toBe(240);

  await page.getByRole("button", { name: "Replier la barre" }).click();

  await expect.poll(async () => (await side.boundingBox())?.width).toBe(64);
  await page.reload();
  await expect(page.getByRole("button", { name: "Déplier la barre" })).toBeVisible();
  await expect.poll(async () => (await side.boundingBox())?.width).toBe(64);
  // The rail keeps the way to every page: icons with their names as tooltips.
  await expect(page.getByRole("link", { name: "Aéronefs" })).toHaveAttribute("title", "Aéronefs");
});

test("on a phone the side bar is a drawer opened from the top bar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await openSession(page);
  await emptyData(page);
  await page.goto("/dashboard");

  await expect(page.getByRole("link", { name: "Aéronefs" })).toHaveCount(0);
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await expect(page.getByRole("link", { name: "Aéronefs" })).toBeVisible();

  await page.getByRole("link", { name: "Aéronefs" }).click();

  await expect(page).toHaveURL(/\/aircraft$/);
  await expect(page.getByRole("link", { name: "Aéronefs" })).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the Escape key closes the drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await openSession(page);
  await emptyData(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await expect(page.getByRole("link", { name: "Aéronefs" })).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.getByRole("link", { name: "Aéronefs" })).toHaveCount(0);
});

test("an address that leads nowhere shows the lost contact page", async ({ page }) => {
  await page.goto("/nowhere/at-all");

  await expect(page.getByRole("heading", { level: 1, name: "Aucun écho sur cette route" })).toBeVisible();
  await expect(page.getByText("/nowhere/at-all")).toBeVisible();
  await expect(page.getByRole("link", { name: "Retour à l'accueil" })).toHaveAttribute("href", "/");
});

test("the lost contact page leads a logged in user back to the dashboard", async ({ page }) => {
  await openSession(page);
  await emptyData(page);
  await page.goto("/nowhere");

  await page.getByRole("link", { name: "Retour au tableau de bord" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("navigation", { name: "Navigation principale" })).toBeVisible();
});

test("the home page offers a logged in user to open the application", async ({ page }) => {
  await openSession(page);
  await emptyData(page);
  await page.goto("/");

  await page.getByRole("link", { name: "Ouvrir l'application" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
});

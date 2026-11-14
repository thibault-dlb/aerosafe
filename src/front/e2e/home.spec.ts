import { expect, type Page, test } from "@playwright/test";

import { emptyData, openSession } from "./session";

test("the home page shows the application name", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "AeroSafe" })).toBeVisible();
});

test("the educational disclaimer is in the footer, and on the log in and sign up pages", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("contentinfo")).toContainText("projet pédagogique");
  await expect(page.getByRole("status").filter({ hasText: "Projet pédagogique" })).toHaveCount(0);

  for (const path of ["/login", "/signup"]) {
    await page.goto(path);
    await expect(page.getByRole("status").filter({ hasText: "Projet pédagogique" })).toBeVisible();
  }
});

test("the home page is in French and switches to English, and the choice is kept", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Tableau de bord" }).first()).toBeVisible();

  await page.getByRole("button", { name: "English" }).click();

  await expect(page.getByRole("link", { name: "Dashboard" }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "Dashboard" }).first()).toBeVisible();
});

test("the theme follows the system until the user chooses", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Passer au thème sombre" })).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.*/);
});

test("the theme switches between dark and light", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  await page.getByRole("button", { name: "Passer au thème clair" }).click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Passer au thème sombre" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("the home page does not scroll sideways on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );

  expect(overflow).toBeLessThanOrEqual(0);
});

/** Scrolls to a fraction of the hero, the part of the page that plays the scene. */
async function scrollHero(page: Page, fraction: number) {
  await page.evaluate((part) => {
    const hero = document.querySelector("section") as HTMLElement;
    window.scrollTo(0, (hero.offsetHeight - window.innerHeight) * part);
  }, fraction);
  // The scene follows the scroll with a short delay.
  await page.waitForTimeout(1500);
}

test("the scroll plays the scene: the title leaves, the aircraft flies, the alert appears", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Ouvrir le tableau de bord" }).first()).toBeVisible();

  await scrollHero(page, 0.45);
  await expect(page.getByText("Suivre.")).toBeVisible();
  await expect(page.getByText("Nominal")).toBeVisible();
  await expect(page.getByText("Alerte R3")).toHaveCount(0);

  await scrollHero(page, 1);
  await expect(page.getByText("Alerte R3")).toBeVisible();
  await expect(page.getByText("Variation d'altitude importante")).toBeVisible();
  await expect(page.getByText("Détecter.")).toBeVisible();
});

test("the top bar is clear over the scene and turns solid once the page scrolls", async ({ page }) => {
  await page.goto("/");
  const bar = page.getByRole("banner");
  await expect(bar).not.toHaveClass(/barSolid/);

  await scrollHero(page, 0.3);

  await expect(bar).toHaveClass(/barSolid/);
});

test("the landing page stays dark even when the system asks for the light theme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const dark = await page.evaluate(() => getComputedStyle(document.querySelector(".darkScope")!).backgroundColor);
  expect(dark).toBe("rgb(28, 17, 11)");

  await openSession(page);
  await emptyData(page);
  await page.goto("/dashboard");
  const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(light).toBe("rgb(251, 245, 230)");
});

test("the sections under the scene tell what the application does and lead to its pages", async ({ page }) => {
  await openSession(page);
  await emptyData(page);
  await page.goto("/");
  await page.getByRole("heading", { name: "Comment ça marche" }).scrollIntoViewIfNeeded();

  await expect(page.getByRole("heading", { level: 3, name: "Chaque écart devient une alerte" })).toBeVisible();
  await expect(page.getByRole("region", { name: "AeroSafe en chiffres" })).toContainText("856");
  await expect(page.getByRole("heading", { level: 3, name: "Alerter" })).toBeVisible();
  await page.getByRole("link", { name: "Régler les règles" }).click();
  await expect(page).toHaveURL(/\/rules$/);
});

test("with reduced motion the scene does not play and the page shows its final state", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "AeroSafe" })).toBeVisible();
  const hero = await page.evaluate(() => (document.querySelector("section") as HTMLElement).offsetHeight);
  expect(hero).toBeLessThan(1500);
  await expect(page.getByRole("region", { name: "AeroSafe en chiffres" })).toContainText("856");
});

test("the dashboard opens on the live overview and the map", async ({ page }) => {
  await openSession(page);
  await emptyData(page);

  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "En direct · Île-de-France" })).toBeVisible();
});

test("the dashboard sends a visitor who is not logged in to the log in screen", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/login$/);
});

test("the replay link of the features opens the dashboard in the replay mode", async ({ page }) => {
  await openSession(page);
  await emptyData(page);
  await page.goto("/");
  await page.getByRole("heading", { level: 3, name: "Rejouez une année de trafic" }).scrollIntoViewIfNeeded();

  await page.locator("li", { hasText: "Rejouez une année de trafic" }).getByRole("link").click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("button", { name: "Rejeu" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Rejeu du trafic historique" })).toBeVisible();
});

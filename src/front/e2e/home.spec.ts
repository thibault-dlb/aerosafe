import { expect, test } from "@playwright/test";

test("the home page shows the application name", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "AeroSafe" })).toBeVisible();
});

test("the home page shows the educational disclaimer", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Projet pédagogique")).toBeVisible();
});

test("the home page is in French and switches to English, and the choice is kept", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Tableau de bord" }).first()).toBeVisible();

  await page.getByRole("button", { name: "English" }).click();

  await expect(page.getByRole("link", { name: "Dashboard" }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "Dashboard" }).first()).toBeVisible();
});

test("the theme switches between dark and light", async ({ page }) => {
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

import { expect, test } from "@playwright/test";

import { freshEmail } from "./session";

const PASSWORD = "a long enough password";

test("a visitor signs up, lands on the page that was asked for, logs out and logs in again", async ({ page }) => {
  const email = freshEmail();

  await page.goto("/aircraft");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("navigation", { name: "Connexion ou inscription" }).getByRole("link", { name: "Inscription" }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  await expect(page).toHaveURL(/\/aircraft$/);
  await expect(page.getByRole("status").filter({ hasText: "Bienvenue sur AeroSafe" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Se déconnecter" })).toBeVisible();

  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Connexion" })).toBeVisible();

  await page.goto("/login");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("status").filter({ hasText: "Bienvenue" })).toHaveCount(0);
});

test("the session survives a reload and the pages of the Supervisor stay closed to a User", async ({ page }) => {
  const email = freshEmail();
  await page.goto("/signup");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("button", { name: "Se déconnecter" })).toBeVisible();

  await page.goto("/alerts");
  await expect(page.getByRole("heading", { name: "Accès réservé" })).toBeVisible();
});

test("a wrong password is refused, and the message stays on the log in mode", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Adresse e-mail").fill(freshEmail());
  await page.getByLabel("Mot de passe").fill(PASSWORD);

  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page.getByRole("alert")).toContainText("E-mail ou mot de passe incorrect.");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("navigation", { name: "Connexion ou inscription" }).getByRole("link", { name: "Inscription" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("an e-mail that already has an account cannot sign up again", async ({ page }) => {
  const email = freshEmail();
  await page.goto("/signup");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("button", { name: "Se déconnecter" }).click();

  await page.goto("/signup");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  await expect(page.getByRole("alert")).toContainText("Cet e-mail a déjà un compte.");
});

test("the length gauge follows the password, and the password can be shown", async ({ page }) => {
  await page.goto("/signup");
  const password = page.getByLabel("Mot de passe");

  await password.fill("court");
  await expect(page.getByRole("meter", { name: "Longueur du mot de passe" })).toHaveAttribute("aria-valuenow", "5");
  await password.fill(PASSWORD);
  await expect(page.getByText("Longueur suffisante")).toBeVisible();

  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Afficher le mot de passe" }).click();
  await expect(password).toHaveAttribute("type", "text");
});

test("the radar goes on when the panels swap, and what was typed is kept", async ({ page }) => {
  await page.goto("/login");
  const radar = page.getByRole("img", { name: /Écran radar/ });
  await expect(radar).toBeVisible();
  await radar.evaluate((element) => element.setAttribute("data-same-radar", "yes"));
  await page.getByLabel("Adresse e-mail").fill("jane@example.fr");

  await page.getByRole("link", { name: "Créer un compte" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Créer un compte" })).toBeVisible();
  await expect(radar).toHaveAttribute("data-same-radar", "yes");
  await expect(page.getByLabel("Adresse e-mail")).toHaveValue("jane@example.fr");
  // The form slides to the right half and the radar to the left half.
  await expect
    .poll(async () => {
      const form = await page.getByRole("main").boundingBox();
      const view = page.viewportSize();
      return form !== null && view !== null && form.x > view.width / 2;
    })
    .toBe(true);
});

test("the log in screen stays dark when the system asks for the light theme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/login");

  const background = await page.evaluate(() => getComputedStyle(document.querySelector("[class*='screen']") as Element).backgroundColor);

  expect(background).toBe("rgb(28, 17, 11)");
});

test("the log in screen does not scroll sideways on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  for (const path of ["/login", "/signup"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

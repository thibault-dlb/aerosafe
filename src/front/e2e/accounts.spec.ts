import { expect, test } from "@playwright/test";

import { emptyData, openSession } from "./session";

const ME = {
  id: "01E2EACCOUNT",
  email: "e2e@example.fr",
  role: "SUPERVISOR",
  is_active: true,
  must_change_password: false,
  is_anonymised: false,
  created_at: "2026-11-01T09:00:00Z",
};

const PILOT = { ...ME, id: "01E2EPILOT", email: "pilot@example.fr", role: "USER" };

test("a Supervisor lists the accounts, changes a role, deactivates and anonymises one", async ({ page }) => {
  await openSession(page, "SUPERVISOR");
  await emptyData(page);
  let pilot = PILOT;
  await page.route("**/api/v1/users**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (request.method() === "PATCH") {
      pilot = { ...pilot, ...request.postDataJSON() };
      return route.fulfill({ json: pilot });
    }
    if (pathname.endsWith("/anonymise")) {
      pilot = { ...pilot, email: "anonyme-01E2EPILOT@aerosafe.invalid", is_active: false, is_anonymised: true };
      return route.fulfill({ json: pilot });
    }
    return route.fulfill({ json: { items: [ME, pilot], total: 2 } });
  });

  await page.goto("/admin/accounts");
  await expect(page.getByRole("heading", { level: 1, name: "Comptes" })).toBeVisible();

  // The account of the Supervisor who looks has no control.
  const mine = page.getByRole("row", { name: /e2e@example\.fr/ });
  await expect(mine.getByRole("switch")).toBeDisabled();

  const line = page.getByRole("row", { name: /pilot@example\.fr/ });
  await line.getByRole("combobox").selectOption("SUPERVISOR");
  await expect(page.getByText("pilot@example.fr est maintenant Superviseur.")).toBeVisible();

  await line.getByRole("switch").click();
  await expect(page.getByText(/pilot@example\.fr est désactivé/)).toBeVisible();
  await expect(line.getByText("Désactivé")).toBeVisible();

  await line.getByRole("button", { name: "Anonymiser pilot@example.fr" }).click();
  const dialog = page.getByRole("dialog", { name: "Anonymiser ce compte ?" });
  await expect(dialog.getByRole("button", { name: "Anonymiser le compte" })).toBeDisabled();
  await dialog.getByLabel("Tapez ANONYMISER pour confirmer").fill("ANONYMISER");
  await dialog.getByRole("button", { name: "Anonymiser le compte" }).click();

  await expect(page.getByText("Le compte est anonymisé.")).toBeVisible();
  const gone = page.getByRole("row", { name: /Compte anonymisé/ });
  await expect(gone.getByText("Anonymisé", { exact: true })).toBeVisible();
  await expect(gone.getByRole("switch")).toHaveCount(0);
});

test("a Supervisor creates an account and sees its provisional password once", async ({ page }) => {
  await openSession(page, "SUPERVISOR");
  await emptyData(page);
  const created = { ...PILOT, id: "01E2ENEW", email: "new@example.fr", must_change_password: true };
  let accounts = [ME];
  await page.route("**/api/v1/users**", async (route) => {
    if (route.request().method() === "POST") {
      accounts = [...accounts, created];
      return route.fulfill({ status: 201, json: { account: created, temporary_password: "ABCDE-FGHJK-MNPQR-STUVW" } });
    }
    return route.fulfill({ json: { items: accounts, total: accounts.length } });
  });

  await page.goto("/admin/accounts");
  await page.getByRole("button", { name: "Créer un compte" }).click();
  await page.getByLabel("Adresse e-mail").fill("new@example.fr");
  await page.getByRole("button", { name: "Créer le compte" }).click();

  const dialog = page.getByRole("dialog", { name: "Compte créé" });
  await expect(dialog.getByText("ABCDE-FGHJK-MNPQR-STUVW")).toBeVisible();
  await dialog.getByRole("button", { name: "Terminé" }).click();

  const line = page.getByRole("row", { name: /new@example\.fr/ });
  await expect(line.getByText("Mot de passe provisoire")).toBeVisible();
  await expect(page.getByText("ABCDE-FGHJK-MNPQR-STUVW")).toHaveCount(0);
});

test("an account with a provisional password must choose its own before anything else", async ({ page }) => {
  const user = { id: "01E2ENEW", email: "new@example.fr", role: "USER", is_active: true };
  const tokens = (mustChange: boolean) => ({
    access_token: "e2e-access-token",
    token_type: "bearer",
    expires_in: 900,
    user: { ...user, must_change_password: mustChange },
  });
  await page.route("**/api/v1/auth/refresh", (route) => route.fulfill({ status: 401, json: { detail: "Session expired" } }));
  await page.route("**/api/v1/auth/login", (route) => route.fulfill({ json: tokens(true) }));
  let sent: unknown;
  await page.route("**/api/v1/auth/password", (route) => {
    sent = route.request().postDataJSON();
    return route.fulfill({ json: tokens(false) });
  });
  await emptyData(page);

  await page.goto("/aircraft");
  await page.getByLabel("Adresse e-mail", { exact: true }).fill("new@example.fr");
  await page.getByLabel("Mot de passe", { exact: true }).fill("ABCDE-FGHJK-MNPQR-STUVW");
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Choisissez votre mot de passe" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Recherche d'aéronefs" })).toHaveCount(0);

  await page.getByLabel("Mot de passe actuel").fill("ABCDE-FGHJK-MNPQR-STUVW");
  await page.getByLabel("Nouveau mot de passe").fill("a new long password");
  await page.getByRole("button", { name: "Continuer" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Recherche d'aéronefs" })).toBeVisible();
  expect(sent).toEqual({ current_password: "ABCDE-FGHJK-MNPQR-STUVW", new_password: "a new long password" });
});

test("the account page changes the units, and the pages follow", async ({ page }) => {
  await openSession(page, "USER");
  await emptyData(page);

  await page.goto("/dashboard");
  await page.getByRole("link", { name: /e2e@example\.fr/ }).click();

  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { level: 1, name: "Mon compte" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Informations" })).toContainText("e2e@example.fr");
  await page.getByRole("button", { name: "Aéronautiques (ft, kt, NM)" }).click();
  await expect(page.getByRole("button", { name: "Aéronautiques (ft, kt, NM)" })).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(page.getByRole("button", { name: "Aéronautiques (ft, kt, NM)" })).toHaveAttribute("aria-pressed", "true");
});

test("a User deletes their own account with their password", async ({ page }) => {
  await openSession(page, "USER");
  await emptyData(page);
  let sent: unknown;
  await page.route("**/api/v1/users/me/anonymise", (route) => {
    sent = route.request().postDataJSON();
    return route.fulfill({ status: 204 });
  });

  await page.goto("/account");
  await page.getByRole("button", { name: "Supprimer mon compte" }).click();
  await page.getByLabel("Votre mot de passe").fill("my password!");
  await page.getByRole("button", { name: "Supprimer définitivement" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Votre compte est supprimé.")).toBeVisible();
  expect(sent).toEqual({ password: "my password!" });
});

import { expect, test } from "@playwright/test";

import { emptyData, openSession } from "./session";

const ALERT = {
  id: "01E2EALERT00000000000001",
  aircraft_id: "01E2EAIRCRAFT0000000001",
  icao24: "3c6444",
  registration: "F-GKXA",
  rule_code: "R3",
  rule_description: "Variation importante d'altitude",
  triggered_at: "2026-11-14T14:02:11Z",
  episode_ended_at: null,
  observed_value: 42,
  threshold: 25,
  unit: "m/s",
  message: "Taux de montée de 42 m/s au-dessus du seuil de 25 m/s.",
  criticality: "HIGH",
  processed_at: null,
};

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

test("the alerts page opens for a Supervisor and says when the sky is clear", async ({ page }) => {
  await openSession(page, "SUPERVISOR");
  await emptyData(page);

  await page.goto("/alerts");

  await expect(page.getByRole("heading", { level: 1, name: "Alertes" })).toBeVisible();
  await expect(page.getByText("Ciel calme")).toBeVisible();
  await expect(page.getByRole("button", { name: "Non traitées" })).toHaveAttribute("aria-pressed", "true");
});

test("a Supervisor opens the details of an alert and marks it as processed", async ({ page }) => {
  await openSession(page, "SUPERVISOR");
  await emptyData(page);
  let processed = false;
  await page.route("**/api/v1/alerts**", (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      processed = true;
      return route.fulfill({ json: { ...ALERT, processed_at: "2026-11-14T14:10:00Z" } });
    }
    const items = processed ? [] : [ALERT];
    return route.fulfill({ json: { items, total: items.length } });
  });

  await page.goto("/alerts");
  await page.getByRole("button", { name: "Détails de R3 pour F-GKXA" }).click();

  const details = page.getByRole("region", { name: "Détail de l'alerte" });
  await expect(details).toContainText("R3 · Variation d'altitude");
  await expect(details).toContainText("42 m/s");
  await expect(details).toContainText("seuil 25 m/s");

  await details.getByRole("button", { name: "Marquer comme traitée" }).click();

  await expect(page.getByText("Alerte R3 de F-GKXA traitée.")).toBeVisible();
  await expect(page.getByText("Ciel calme")).toBeVisible();
});

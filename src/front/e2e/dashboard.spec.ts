import { expect, test } from "@playwright/test";

import { emptyData, openSession } from "./session";

const NOW = new Date().toISOString();

const ALERT = {
  id: "01E2EALERT",
  aircraft_id: "01E2EAIRCRAFT",
  icao24: "3c6444",
  registration: "F-GKXA",
  rule_code: "R1",
  rule_description: "Délai trop long depuis le dernier contact",
  triggered_at: NOW,
  episode_ended_at: null,
  observed_value: 420,
  threshold: 300,
  unit: "s",
  message: "R1 delay since the last contact for 3c6444",
  criticality: "HIGH",
  processed_at: null,
};

const AIRCRAFT = {
  id: "01E2EAIRCRAFT",
  icao24: "3c6444",
  registration: "F-GKXA",
  model: "Airbus A320",
  airline: "Air France",
  last_contact_at: NOW,
  latitude: 48.8,
  longitude: 2.3,
  altitude: 9000,
  heading: 90,
  on_ground: false,
  speed: 230,
};

const OBSERVATIONS = [0, 1, 2, 3].map((index) => ({
  last_contact_at: new Date(Date.now() - (4 - index) * 600_000).toISOString(),
  position_at: new Date(Date.now() - (4 - index) * 600_000).toISOString(),
  latitude: 48.7 + index * 0.03,
  longitude: 2.0 + index * 0.1,
  altitude: 3000 + index * 2000,
  speed: 220,
  heading: 80,
  on_ground: false,
  flight_id: "01E2EFLIGHT",
}));

const DASHBOARD = {
  counters: { active_alerts: 4, unprocessed_alerts: 9, alerts_24h: 17 },
  active_alerts: [ALERT],
  alerted_aircraft: [ALERT],
  collection: {
    enabled: true,
    paused: false,
    running: false,
    last_success_at: NOW,
    remaining_credits: 3900,
    recent_runs: [
      { started_at: NOW, status: "SUCCESS" },
      { started_at: NOW, status: "FAILED" },
    ],
  },
};

function statistics(period: string) {
  const days = period === "24h" ? 24 : period === "7d" ? 7 : 30;
  const slices = Array.from({ length: days }, (_, index) => ({
    start: new Date(Date.UTC(2026, 10, 1, index)).toISOString(),
    total: index % 3 === 0 ? 2 : 0,
    per_rule: index % 3 === 0 ? { R1: 1, R3: 1 } : {},
  }));
  return { period, unit: period === "24h" ? "hour" : "day", start: slices[0].start, end: NOW, total: slices.reduce((sum, item) => sum + item.total, 0), slices };
}

async function mockDashboard(page: import("@playwright/test").Page) {
  await emptyData(page);
  await page.route("**/api/v1/aircraft?**", (route) => route.fulfill({ json: [AIRCRAFT] }));
  await page.route("**/api/v1/aircraft/*/observations**", (route) => route.fulfill({ json: OBSERVATIONS }));
  await page.route("**/api/v1/dashboard**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/statistics")) return route.fulfill({ json: statistics(url.searchParams.get("period") ?? "24h") });
    return route.fulfill({ json: DASHBOARD });
  });
}

test("a Supervisor sees the figures, the chart and the collection, and can act", async ({ page }) => {
  await openSession(page, "SUPERVISOR");
  await mockDashboard(page);
  let paused = false;
  await page.route("**/api/v1/collection/pause", (route) => {
    paused = true;
    return route.fulfill({ json: {} });
  });

  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { level: 1, name: "Tableau de bord" })).toBeVisible();
  await expect(page.getByText("À traiter")).toBeVisible();
  await expect(page.getByRole("region", { name: "Alertes actives" }).getByRole("table")).toBeVisible();
  await expect(page.getByRole("link", { name: "Voir les 4 alertes actives" })).toBeVisible();

  const chart = page.getByRole("region", { name: "Alertes par règle" });
  await expect(chart.getByRole("img")).toBeVisible();
  await chart.getByRole("button", { name: "7 jours" }).click();
  await expect(chart.getByRole("button", { name: "7 jours" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Mettre en pause" }).click();
  await expect(page.getByText("Collecte mise en pause.")).toBeVisible();
  expect(paused).toBe(true);
});

test("a User reads the same dashboard, with no button that acts", async ({ page }) => {
  await openSession(page, "USER");
  await mockDashboard(page);

  await page.goto("/dashboard");

  await expect(page.getByRole("region", { name: "Alertes actives" }).getByRole("table")).toBeVisible();
  await expect(page.getByRole("region", { name: "Collecte OpenSky" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mettre en pause" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Lancer maintenant" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Marquer l'alerte/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /alertes actives/ })).toHaveCount(0);
});

test("the map is drawn without any tile, and an aircraft is followed from the search box", async ({ page }) => {
  const outside: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://localhost")) outside.push(request.url());
  });
  await openSession(page, "USER");
  await mockDashboard(page);

  await page.goto("/dashboard");

  const map = page.getByRole("img", { name: /Carte du trafic/ });
  await expect(map).toBeVisible();
  await expect(map.locator("canvas")).toHaveCount(2);
  await expect(page.getByText("Aéronefs suivis")).toBeVisible();

  const search = page.getByRole("combobox", { name: "Suivre un aéronef" });
  await search.fill("F-GKXA");
  // The suggestions come from the aircraft read by the page: wait for them, a slow browser answers "not found" before.
  await expect(page.locator('datalist option[value="F-GKXA"]')).toBeAttached();
  await search.press("Enter");

  const card = page.getByRole("region", { name: "Aéronef suivi" });
  await expect(card).toBeVisible();
  await expect(card.getByRole("heading", { name: "F-GKXA" })).toBeVisible();
  await expect(card.getByText("R1")).toBeVisible();
  await expect(card.getByRole("img", { name: /Profil d'altitude du vol : 4 points/ })).toBeVisible();
  await expect(card.getByRole("link", { name: "Ouvrir la fiche" })).toHaveAttribute("href", "/aircraft/01E2EAIRCRAFT");

  await page.getByRole("button", { name: "Recentrer sur la zone" }).click();
  await card.getByRole("button", { name: "Ne plus suivre" }).click();
  await expect(card).toHaveCount(0);
  expect(outside).toEqual([]);
});

test("an alert of the map centres its aircraft, then opens it in the alerts", async ({ page }) => {
  await openSession(page, "SUPERVISOR");
  await mockDashboard(page);
  // The alerts page reads the alert asked for, then the list of its aircraft.
  await page.route("**/api/v1/alerts/01E2EALERT", (route) => route.fulfill({ json: ALERT }));
  await page.route("**/api/v1/alerts?**", (route) => route.fulfill({ json: { items: [ALERT], total: 1 } }));
  await page.route("**/api/v1/rules**", (route) => route.fulfill({ json: [] }));

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Centrer la carte sur F-GKXA (alerte R1)" }).click();

  const card = page.getByRole("region", { name: "Aéronef suivi" });
  await expect(card.getByRole("heading", { name: "F-GKXA" })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: "Ouvrir l'alerte R1 de F-GKXA dans les alertes" }).click();

  await expect(page).toHaveURL(/\/alerts\?alert=01E2EALERT$/);
  await expect(page.getByRole("region", { name: "Détail de l'alerte" })).toBeVisible();
  await expect(page.getByRole("row", { selected: true })).toBeVisible();
});

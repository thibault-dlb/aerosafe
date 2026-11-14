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

const DASHBOARD = {
  counters: { active_alerts: 4, unprocessed_alerts: 9, alerts_24h: 17 },
  active_alerts: [ALERT],
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

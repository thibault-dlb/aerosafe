import { expect, test } from "@playwright/test";

import { emptyData, openSession } from "./session";

const AIRCRAFT = {
  id: "01E2EAIRCRAFT0000000001",
  icao24: "3c6444",
  registration: "F-GKXA",
  model: "Airbus A320",
  airline: "Air France",
  last_contact_at: "2026-11-14T14:02:11Z",
  latitude: 48.85,
  longitude: 2.35,
  altitude: 10400,
  heading: 284,
  on_ground: false,
};

const FLIGHT = {
  id: "01E2EFLIGHT00000000000001",
  aircraft_id: AIRCRAFT.id,
  icao24: AIRCRAFT.icao24,
  registration: AIRCRAFT.registration,
  callsign: "AFR1234",
  started_at: "2026-11-14T13:20:00Z",
  ended_at: null,
  origin: "LFPG",
  destination: null,
};

const POINT = {
  last_contact_at: "2026-11-14T14:02:11Z",
  position_at: "2026-11-14T14:02:11Z",
  latitude: 48.85,
  longitude: 2.35,
  altitude: 10400,
  speed: 231,
  heading: 284,
  on_ground: false,
  flight_id: FLIGHT.id,
};

async function mockAircraft(page: import("@playwright/test").Page) {
  await page.route("**/api/v1/aircraft**", (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith("/observations")) return route.fulfill({ json: [{ ...POINT, last_contact_at: "2026-11-14T14:01:41Z", altitude: 9140 }, POINT] });
    if (pathname.endsWith("/flights")) return route.fulfill({ json: [FLIGHT] });
    if (pathname.endsWith(AIRCRAFT.id)) return route.fulfill({ json: AIRCRAFT });
    return route.fulfill({ json: [AIRCRAFT] });
  });
  await page.route("**/api/v1/flights/**", (route) =>
    route.fulfill({
      json: {
        ...FLIGHT,
        trajectory: [{ ...POINT, last_contact_at: "2026-11-14T13:20:00Z", altitude: 100 }, { ...POINT, last_contact_at: "2026-11-14T13:50:00Z" }, POINT],
        gaps: [],
        statistics: { observation_count: 3, duration_seconds: 2531, distance_km: 548.3, mean_altitude: 8120, max_altitude: 10400, mean_speed: 214, max_speed: 232 },
      },
    }),
  );
}

test("a User searches an aircraft with one field, opens its record and then its flight", async ({ page }) => {
  await openSession(page, "USER");
  await emptyData(page);
  await mockAircraft(page);

  await page.goto("/aircraft");
  await expect(page.getByRole("heading", { level: 1, name: "Recherche d'aéronefs" })).toBeVisible();

  await page.getByLabel("Rechercher un aéronef").fill("Air France");
  await expect(page.getByText("compagnie « Air France »")).toBeVisible();
  await page.getByRole("button", { name: "Chercher" }).click();

  await expect(page.getByRole("heading", { name: "1 aéronef" })).toBeVisible();
  await page.getByRole("link", { name: /F-GKXA/ }).click();

  await expect(page.getByRole("heading", { level: 1, name: "F-GKXA" })).toBeVisible();
  await expect(page.getByText("10400 m").first()).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Fil d'Ariane" })).toContainText("Aéronefs");

  await page.getByRole("link", { name: "AFR1234" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "AFR1234" })).toBeVisible();
  await expect(page.getByText("548.3 km")).toBeVisible();
  await expect(page.getByRole("img", { name: "Profil : Altitude" })).toBeVisible();
  await expect(page.getByText("arrivée inconnue")).toBeVisible();
});

test("the aircraft search says when nothing matches", async ({ page }) => {
  await openSession(page, "USER");
  await emptyData(page);

  await page.goto("/aircraft");
  await page.getByRole("button", { name: "Chercher" }).click();

  await expect(page.getByText("Aucun écho")).toBeVisible();
});

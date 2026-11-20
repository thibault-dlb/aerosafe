import { expect, type Page, test } from "@playwright/test";

import { openSession } from "./session";

const CLOCK = {
  available: true,
  start: "2022-08-01T00:00:00Z",
  end: "2022-08-31T23:59:59Z",
  simulated_at: "2022-08-14T15:00:00Z",
  speed: 10,
  paused: true,
  finished: false,
  server_time: "2026-11-13T10:00:00Z",
  allowed_speeds: [1, 10, 60],
};

/** Answers the replay endpoints like a Supervisor would see them, whatever the database holds. */
async function mockClock(page: Page) {
  let clock = { ...CLOCK };
  await page.route("**/api/v1/replay**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST") {
      if (path.endsWith("/pause")) clock = { ...clock, paused: true };
      if (path.endsWith("/resume")) clock = { ...clock, paused: false };
      if (path.endsWith("/speed")) clock = { ...clock, speed: request.postDataJSON().speed };
    }
    await route.fulfill({ json: clock });
  });
  // The pages behind the bar are not the subject: they get an empty answer.
  await page.route("**/api/v1/aircraft**", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/alerts**", (route) =>
    route.fulfill({ json: { items: [], total: 0 } }),
  );
}

test("the replay is off until the user chooses it, and the choice is kept", async ({ page }) => {
  await openSession(page);
  await mockClock(page);
  await page.goto("/aircraft");
  await expect(page.getByRole("button", { name: "adsb.fi" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Rejeu du trafic historique" })).toHaveCount(0);

  await page.getByRole("button", { name: "Rejeu" }).click();

  await expect(page.getByRole("region", { name: "Rejeu du trafic historique" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Rejeu" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Rejeu du trafic historique" })).toBeVisible();
});

test("the player says so when the clock cannot be read", async ({ page }) => {
  await openSession(page);
  await page.route("**/api/v1/replay**", (route) => route.fulfill({ status: 500, json: { detail: "broken" } }));
  await page.goto("/aircraft");

  await page.getByRole("button", { name: "Rejeu" }).click();

  const player = page.getByRole("region", { name: "Rejeu du trafic historique" });
  await expect(player.getByRole("alert")).toContainText("L'horloge de rejeu est injoignable");
});

test("the replay player shows the simulated time, and pauses and resumes the clock", async ({
  page,
}) => {
  await openSession(page);
  await mockClock(page);
  await page.goto("/aircraft");
  await page.getByRole("button", { name: "Rejeu" }).click();
  const bar = page.getByRole("region", { name: "Rejeu du trafic historique" });

  await expect(bar.locator("time")).toContainText("15:00:00 UTC");
  await expect(bar.getByRole("button", { name: "Reprendre" })).toBeVisible();

  await bar.getByRole("button", { name: "Reprendre" }).click();
  await expect(bar.getByRole("button", { name: "Pause" })).toBeVisible();

  await bar.getByRole("button", { name: "Pause" }).click();
  await expect(bar.getByRole("button", { name: "Reprendre" })).toBeVisible();
});

test("the speed of the replay can be changed", async ({ page }) => {
  await openSession(page);
  await mockClock(page);
  await page.goto("/aircraft");
  await page.getByRole("button", { name: "Rejeu" }).click();
  const speeds = page.getByRole("group", { name: "Vitesse" });
  await expect(speeds.getByRole("button", { name: "×10" })).toHaveAttribute("aria-pressed", "true");

  await speeds.getByRole("button", { name: "×60" }).click();

  await expect(speeds.getByRole("button", { name: "×60" })).toHaveAttribute("aria-pressed", "true");
  await expect(speeds.getByRole("button", { name: "×10" })).toHaveAttribute("aria-pressed", "false");
});

test("going back to the live data hides the replay player", async ({ page }) => {
  await openSession(page);
  await mockClock(page);
  await page.goto("/aircraft");
  await page.getByRole("button", { name: "Rejeu" }).click();
  await expect(page.getByRole("region", { name: "Rejeu du trafic historique" })).toBeVisible();

  await page.getByRole("button", { name: "adsb.fi" }).click();

  await expect(page.getByRole("region", { name: "Rejeu du trafic historique" })).toHaveCount(0);
});

test("every request carries the source shown", async ({ page }) => {
  await mockClock(page);
  const sources: (string | null)[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith("/api/v1/aircraft")) sources.push(url.searchParams.get("source"));
  });

  await openSession(page);
  // The overview that reads the aircraft is the top of the dashboard.
  await page.goto("/dashboard");
  await expect.poll(() => sources.length).toBeGreaterThan(0);
  expect(sources[0]).toBe("adsbfi");
  await page.getByRole("button", { name: "Rejeu" }).click();
  await expect.poll(() => sources.includes("replay")).toBe(true);
  await page.getByRole("button", { name: "OpenSky" }).click();
  await expect.poll(() => sources.at(-1)).toBe("opensky");
});

test("the replay player does not make the page scroll sideways on a phone", async ({ page }) => {
  await openSession(page);
  await mockClock(page);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/aircraft");

  await page.getByRole("button", { name: "Rejeu" }).click();
  await expect(page.getByRole("region", { name: "Rejeu du trafic historique" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the replay player floats at the bottom of the page, and opens the choice of the start", async ({ page }) => {
  await openSession(page);
  await mockClock(page);
  await page.goto("/aircraft");
  const top = await page.getByRole("heading", { level: 1 }).boundingBox();

  await page.getByRole("button", { name: "Rejeu" }).click();
  const player = page.getByRole("region", { name: "Rejeu du trafic historique" });
  await expect(player.locator("time")).toBeVisible();

  // The page does not move down to make room: the player floats over its bottom edge.
  expect(await page.getByRole("heading", { level: 1 }).boundingBox()).toEqual(top);
  const box = await player.getByRole("group", { name: "Vitesse" }).boundingBox();
  const view = page.viewportSize();
  expect(box!.y).toBeGreaterThan(view!.height - 120);

  await expect(player.getByLabel("Démarrer à (UTC)")).toHaveCount(0);
  await player.getByRole("button", { name: "Régler le rejeu" }).click();
  await expect(player.getByLabel("Démarrer à (UTC)")).toBeVisible();
  await expect(player.getByText(/Période disponible/)).toBeVisible();
});

test("the home page has no replay: no player, no choice of data source", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("aerosafe.mode", "replay"));
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("group", { name: "Source des données" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Rejeu du trafic historique" })).toHaveCount(0);
});

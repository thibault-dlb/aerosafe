import { expect, type Page, test } from "@playwright/test";

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
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Direct" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Rejeu du trafic historique" })).toHaveCount(0);

  await page.getByRole("button", { name: "Rejeu" }).click();

  await expect(page.getByRole("region", { name: "Rejeu du trafic historique" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Rejeu" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Rejeu du trafic historique" })).toBeVisible();
});

test("a visitor who is not logged in is invited to log in to see the replay", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Rejeu" }).click();

  const bar = page.getByRole("region", { name: "Rejeu du trafic historique" });
  await expect(bar.getByRole("alert")).toHaveText("Connectez-vous pour voir le rejeu.");
});

test("the replay bar shows the simulated time, and pauses and resumes the clock", async ({
  page,
}) => {
  await mockClock(page);
  await page.goto("/");
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
  await mockClock(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Rejeu" }).click();
  const speeds = page.getByRole("group", { name: "Vitesse" });
  await expect(speeds.getByRole("button", { name: "×10" })).toHaveAttribute("aria-pressed", "true");

  await speeds.getByRole("button", { name: "×60" }).click();

  await expect(speeds.getByRole("button", { name: "×60" })).toHaveAttribute("aria-pressed", "true");
  await expect(speeds.getByRole("button", { name: "×10" })).toHaveAttribute("aria-pressed", "false");
});

test("going back to the live data hides the replay bar", async ({ page }) => {
  await mockClock(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Rejeu" }).click();
  await expect(page.getByRole("region", { name: "Rejeu du trafic historique" })).toBeVisible();

  await page.getByRole("button", { name: "Direct" }).click();

  await expect(page.getByRole("region", { name: "Rejeu du trafic historique" })).toHaveCount(0);
});

test("the replay requests carry the source, and the live ones do not", async ({ page }) => {
  await mockClock(page);
  const sources: (string | null)[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith("/api/v1/aircraft")) sources.push(url.searchParams.get("source"));
  });

  await page.goto("/");
  await expect.poll(() => sources.length).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Rejeu" }).click();
  await expect.poll(() => sources.includes("replay")).toBe(true);
  await page.getByRole("button", { name: "Direct" }).click();
  await expect.poll(() => sources.at(-1)).toBeNull();
});

test("the replay bar does not make the page scroll sideways on a phone", async ({ page }) => {
  await mockClock(page);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");

  await page.getByRole("button", { name: "Rejeu" }).click();
  await expect(page.getByRole("region", { name: "Rejeu du trafic historique" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

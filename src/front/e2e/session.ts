import type { Page } from "@playwright/test";

export type E2eRole = "USER" | "SUPERVISOR";

/**
 * Makes the application find an open session when it starts, as if the visitor had logged in
 * before: the refresh answers with a token and an account of the given role. The pages then
 * work with the data the test gives them, whatever the database holds.
 */
export async function openSession(page: Page, role: E2eRole = "SUPERVISOR") {
  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({
      json: {
        access_token: "e2e-access-token",
        token_type: "bearer",
        expires_in: 900,
        user: { id: "01E2EACCOUNT", email: "e2e@example.fr", role, is_active: true },
      },
    }),
  );
}

/** Empty answers for the pages behind the bar, which are not the subject of the test. */
export async function emptyData(page: Page) {
  await page.route("**/api/v1/aircraft**", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/alerts**", (route) => route.fulfill({ json: { items: [], total: 0 } }));
  await page.route("**/api/v1/rules**", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/v1/dashboard**", (route) =>
    route.fulfill({ json: new URL(route.request().url()).pathname.endsWith("/statistics") ? EMPTY_STATISTICS : EMPTY_DASHBOARD }),
  );
}

const EMPTY_DASHBOARD = {
  counters: { active_alerts: 0, unprocessed_alerts: 0, alerts_24h: 0 },
  active_alerts: [],
  collection: { enabled: true, paused: false, running: false, last_success_at: null, remaining_credits: null, recent_runs: [] },
};

const EMPTY_STATISTICS = { period: "24h", unit: "hour", start: "2026-11-14T00:00:00Z", end: "2026-11-14T10:00:00Z", total: 0, slices: [] };

/** An e-mail address no other test run has used. */
export function freshEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.fr`;
}

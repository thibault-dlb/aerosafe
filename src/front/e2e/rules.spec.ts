import { expect, test } from "@playwright/test";

import { emptyData, openSession } from "./session";

const R1 = {
  code: "R1",
  description: "Délai trop long depuis le dernier contact",
  threshold: 300,
  unit: "s",
  criticality: "MEDIUM",
  is_active: true,
  updated_at: "2026-11-12T14:02:00Z",
};

test("a Supervisor sees the rules as cards and saves a new threshold", async ({ page }) => {
  await openSession(page, "SUPERVISOR");
  await emptyData(page);
  let rule = R1;
  await page.route("**/api/v1/rules**", async (route) => {
    const request = route.request();
    if (request.method() === "PATCH") {
      rule = { ...rule, ...request.postDataJSON(), updated_at: "2026-11-14T15:00:00Z" };
      return route.fulfill({ json: rule });
    }
    return route.fulfill({ json: [rule] });
  });

  await page.goto("/rules");

  await expect(page.getByRole("heading", { level: 1, name: "Règles" })).toBeVisible();
  const card = page.getByRole("form", { name: "R1 · Contact perdu" });
  await expect(card).toBeVisible();
  await expect(card.getByRole("button", { name: "Enregistrer" })).toHaveCount(0);

  await card.getByLabel("Seuil de R1 (s)").fill("420");
  await card.getByRole("button", { name: "Enregistrer" }).click();

  await expect(page.getByText(/R1 enregistrée/)).toBeVisible();
  await expect(card.getByLabel("Seuil de R1 (s)")).toHaveValue("420");
  await expect(card.getByRole("button", { name: "Enregistrer" })).toHaveCount(0);
});

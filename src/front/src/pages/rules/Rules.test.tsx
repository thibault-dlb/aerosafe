import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Rule, type RuleChanges } from "@/models/Rule";
import { ApiError } from "@/services/ApiClient";
import type { RuleService } from "@/services/RuleService";
import { renderInApp } from "@/test/app";

import Rules from "./Rules";

const R1 = new Rule(
  "R1",
  "Délai trop long depuis le dernier contact",
  300,
  "s",
  "MEDIUM",
  true,
  new Date("2026-11-09T10:00:00Z"),
);

const R3 = new Rule("R3", "Variation importante d'altitude", 25, "m/s", "HIGH", true, new Date("2026-11-09T10:00:00Z"));

function renderWith(
  list: RuleService["list"] = async () => [R1, R3],
  update: RuleService["update"] = async (code: string, changes: RuleChanges) =>
    new Rule(
      code,
      R1.description,
      changes.threshold ?? R1.threshold,
      R1.unit,
      changes.criticality === undefined ? R1.criticality : changes.criticality,
      changes.is_active ?? R1.isActive,
      new Date("2026-11-09T11:00:00Z"),
    ),
) {
  const service = { list: vi.fn(list), update: vi.fn(update) } as unknown as RuleService;
  renderInApp(<Rules service={service} />);
  return service.update as ReturnType<typeof vi.fn>;
}

describe("Rules", () => {
  it("shows its title and says when changes apply", () => {
    renderWith();

    expect(screen.getByRole("heading", { level: 1, name: "Règles" })).toBeInTheDocument();
    expect(screen.getByText(/s'applique à la prochaine évaluation/)).toBeInTheDocument();
    expect(screen.getByText("Chargement des règles…")).toBeInTheDocument();
  });

  it("shows one card for each rule", async () => {
    renderWith();

    expect(await screen.findByRole("form", { name: "R1 · Contact perdu" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "R3 · Variation d'altitude" })).toBeInTheDocument();
    expect(screen.getByLabelText("Seuil de R1 (s)")).toHaveValue(300);
  });

  it("says when there is no rule", async () => {
    renderWith(async () => []);

    expect(await screen.findByText("Aucune règle n'est définie.")).toBeInTheDocument();
  });

  it("saves a rule, confirms it and shows the new settings", async () => {
    const update = renderWith();

    fireEvent.change(await screen.findByLabelText("Seuil de R1 (s)"), { target: { value: "420" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Enregistrer" })[0]);

    await waitFor(() => expect(update).toHaveBeenCalledWith("R1", { threshold: 420 }));
    expect(await screen.findByText(/R1 enregistrée/)).toBeInTheDocument();
    expect(screen.getByLabelText("Seuil de R1 (s)")).toHaveValue(420);
    expect(screen.queryByRole("button", { name: "Enregistrer" })).not.toBeInTheDocument();
  });

  it("explains a failed save in a notification and keeps the change", async () => {
    renderWith(undefined, async () => {
      throw new ApiError(403);
    });

    fireEvent.change(await screen.findByLabelText("Seuil de R1 (s)"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Seuls les Superviseurs");
    expect(screen.getByLabelText("Seuil de R1 (s)")).toHaveValue(1);
  });

  it("explains a failed loading", async () => {
    renderWith(async () => {
      throw new ApiError(401);
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Connectez-vous");
    expect(screen.queryByText("Chargement des règles…")).not.toBeInTheDocument();
  });
});

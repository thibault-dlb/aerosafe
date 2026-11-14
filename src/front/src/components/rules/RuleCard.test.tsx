import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Rule, type RuleChanges } from "@/models/Rule";
import { renderWithPreferences } from "@/test/preferences";

import RuleCard from "./RuleCard";

const R3 = new Rule("R3", "Variation importante d'altitude", 25, "m/s", "HIGH", true, new Date("2026-11-12T14:05:00Z"));

function show(rule: Rule = R3, onSave: (code: string, changes: RuleChanges) => Promise<void> = async () => undefined) {
  const save = vi.fn(onSave);
  renderWithPreferences(<RuleCard rule={rule} onSave={save} />);
  return save;
}

describe("RuleCard", () => {
  it("names the rule, says what it detects and shows its settings", () => {
    show();

    expect(screen.getByRole("heading", { name: "R3 · Variation d'altitude" })).toBeInTheDocument();
    expect(screen.getByText(/Montée ou descente trop rapide/)).toBeInTheDocument();
    expect(screen.getByLabelText("Seuil de R3 (m/s)")).toHaveValue(25);
    expect(screen.getByRole("switch", { name: "R3 évaluée" })).toBeChecked();
    expect(screen.getByRole("button", { name: /Haute/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Modifiée le/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Schéma de la règle R3" })).toBeInTheDocument();
  });

  it("offers no way to save until something changes", () => {
    show();

    expect(screen.queryByRole("button", { name: "Enregistrer" })).not.toBeInTheDocument();
  });

  it("saves only the changed settings", async () => {
    const save = show();

    fireEvent.change(screen.getByLabelText("Seuil de R3 (m/s)"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: /Aucune/ }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith("R3", { threshold: 30, criticality: null }));
  });

  it("can switch the rule off, and on again", async () => {
    const save = show();

    fireEvent.click(screen.getByRole("switch", { name: "R3 évaluée" }));
    expect(screen.getByText("Non évaluée")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith("R3", { is_active: false }));

    fireEvent.click(screen.getByRole("switch"));
    expect(screen.queryByRole("button", { name: "Enregistrer" })).not.toBeInTheDocument();
  });

  it("goes back to nothing to save when a change is undone", () => {
    show();

    fireEvent.change(screen.getByLabelText("Seuil de R3 (m/s)"), { target: { value: "30" } });
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Seuil de R3 (m/s)"), { target: { value: "25" } });

    expect(screen.queryByRole("button", { name: "Enregistrer" })).not.toBeInTheDocument();
  });

  it("refuses a negative or empty threshold, and says why", () => {
    show();
    const input = screen.getByLabelText("Seuil de R3 (m/s)");

    fireEvent.change(input, { target: { value: "-1" } });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Saisissez un nombre positif ou nul.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Aucune/ }));
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled();

    fireEvent.change(input, { target: { value: "" } });
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("does not send an invalid form", () => {
    const save = show();
    fireEvent.change(screen.getByLabelText("Seuil de R3 (m/s)"), { target: { value: "-1" } });
    fireEvent.click(screen.getByRole("button", { name: /Aucune/ }));

    fireEvent.submit(screen.getByRole("form"));

    expect(save).not.toHaveBeenCalled();
  });

  it("does not send a form with nothing changed", () => {
    const save = show();

    fireEvent.submit(screen.getByRole("form"));

    expect(save).not.toHaveBeenCalled();
  });

  it("blocks the button while saving", async () => {
    let finish: () => void = () => undefined;
    show(R3, () => new Promise<void>((resolve) => (finish = resolve)));
    fireEvent.change(screen.getByLabelText("Seuil de R3 (m/s)"), { target: { value: "30" } });

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByRole("button", { name: "Enregistrement…" })).toBeDisabled();
    finish();
    expect(await screen.findByRole("button", { name: "Enregistrer" })).toBeEnabled();
  });

  it("shows the description of the API for a rule it has no text for", () => {
    show(new Rule("R6", "Vitesse au sol excessive", 300, "m/s", null, false, new Date("2026-11-12T14:05:00Z")));

    expect(screen.getByRole("heading", { name: "R6 · Vitesse au sol excessive" })).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Schéma/ })).not.toBeInTheDocument();
  });
});

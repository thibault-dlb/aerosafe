import { fireEvent, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { Alert } from "@/models/Alert";
import { renderWithPreferences } from "@/test/preferences";

import AlertDetail, { type AlertDetailProps } from "./AlertDetail";

const TRIGGERED = new Date("2026-11-14T14:02:11Z");

function alert(overrides: { processedAt?: Date | null; episodeEndedAt?: Date | null; observed?: number | null; threshold?: number | null } = {}) {
  return new Alert(
    "A1",
    "R3",
    TRIGGERED,
    "Taux de montée de 42 m/s au-dessus du seuil.",
    "01JC0000000000000000000001",
    "3c6444",
    "AFR1234",
    "Variation importante d'altitude",
    overrides.observed === undefined ? 42 : overrides.observed,
    overrides.threshold === undefined ? 25 : overrides.threshold,
    "m/s",
    "HIGH",
    overrides.episodeEndedAt ?? null,
    overrides.processedAt ?? null,
  );
}

function show(shown: Alert, props: Partial<AlertDetailProps> = {}, preferences: Record<string, string> = {}) {
  const onClose = vi.fn();
  const onProcess = vi.fn();
  renderWithPreferences(
    <MemoryRouter>
      <AlertDetail alert={shown} onClose={onClose} onProcess={onProcess} {...props} />
    </MemoryRouter>,
    { preferences },
  );
  return { onClose, onProcess };
}

describe("AlertDetail", () => {
  it("tells the rule, the aircraft, the situation and the message", () => {
    show(alert());

    expect(screen.getByRole("region", { name: "Détail de l'alerte" })).toBeInTheDocument();
    expect(screen.getByText("R3 · Variation d'altitude")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "AFR1234" })).toHaveAttribute("href", "/aircraft/01JC0000000000000000000001");
    expect(screen.getByText("Toujours en cours")).toBeInTheDocument();
    expect(screen.getByText("Taux de montée de 42 m/s au-dessus du seuil.")).toBeInTheDocument();
    expect(screen.getByText("Haute")).toBeInTheDocument();
  });

  it("puts the value observed against the threshold, and shows the drawing of the rule", () => {
    const { container } = renderShown();

    expect(screen.getByText("42 m/s")).toBeInTheDocument();
    expect(screen.getByText("seuil 25 m/s")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Schéma de la règle R3" })).toBeInTheDocument();
    expect(container.querySelector("u")).not.toBeNull();

    function renderShown() {
      return renderWithPreferences(
        <MemoryRouter>
          <AlertDetail alert={alert()} onClose={() => undefined} onProcess={() => undefined} />
        </MemoryRouter>,
      );
    }
  });

  it("shows the values in the unit system chosen", () => {
    show(alert(), {}, { "aerosafe.units": "aeronautical" });

    expect(screen.getByText("8267.7 ft/min")).toBeInTheDocument();
  });

  it("draws no gauge when a value is missing", () => {
    show(alert({ observed: null }));

    expect(document.querySelector("u")).toBeNull();
    expect(screen.getByText("–")).toBeInTheDocument();
  });

  it("draws no gauge when both values are zero", () => {
    show(alert({ observed: 0, threshold: 0 }));

    expect(document.querySelector("u")).toBeNull();
  });

  it("keeps the minus sign of a descent, and compares its size with the threshold", () => {
    const { container } = renderWithPreferences(
      <MemoryRouter>
        <AlertDetail alert={alert({ observed: -42 })} onClose={() => undefined} onProcess={() => undefined} />
      </MemoryRouter>,
    );

    const value = screen.getByText("-42 m/s");
    expect(value.className).toMatch(/over/);
    expect(container.querySelector("u")?.previousElementSibling?.getAttribute("style")).toMatch(/width: 83\.3/);
  });

  it("does not flag a value that stays under its threshold", () => {
    show(alert({ observed: 10 }));

    expect(screen.getByText("10 m/s").className).not.toMatch(/over/);
  });

  it("offers to process an alert that is not, and not twice", () => {
    const { onProcess } = show(alert());

    fireEvent.click(screen.getByRole("button", { name: "Marquer comme traitée" }));

    expect(onProcess).toHaveBeenCalledOnce();
  });

  it("shows when and that an alert was processed", () => {
    show(alert({ processedAt: TRIGGERED, episodeEndedAt: TRIGGERED }));

    expect(screen.queryByRole("button", { name: "Marquer comme traitée" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Traitée").length).toBeGreaterThan(0);
    expect(screen.getByText("Terminée")).toBeInTheDocument();
  });

  it("blocks the button while the alert is being processed", () => {
    show(alert(), { processing: true });

    expect(screen.getByRole("button", { name: "Marquer comme traitée" })).toBeDisabled();
  });

  it("closes, and leads to the aircraft and to the threshold of the rule", () => {
    const { onClose } = show(alert());

    fireEvent.click(screen.getByRole("button", { name: "Fermer le détail" }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Voir l'aéronef" })).toHaveAttribute("href", "/aircraft/01JC0000000000000000000001");
    expect(screen.getByRole("link", { name: "Pas pertinent ? Ajuster le seuil de R3" })).toHaveAttribute("href", "/rules");
  });
});

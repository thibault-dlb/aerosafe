import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EmptyState, { type EmptyKind } from "./EmptyState";

describe("EmptyState", () => {
  it("says what is empty and why, with an optional action", () => {
    render(
      <EmptyState kind="alerts" title="Ciel calme" action={<button type="button">Effacer les filtres</button>}>
        Aucune alerte ne correspond à ces filtres.
      </EmptyState>,
    );

    expect(screen.getByText("Ciel calme")).toBeInTheDocument();
    expect(screen.getByText("Aucune alerte ne correspond à ces filtres.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Effacer les filtres" })).toBeInTheDocument();
  });

  it("has no action area without an action", () => {
    const { container } = render(
      <EmptyState kind="results" title="Aucun écho">
        Rien.
      </EmptyState>,
    );

    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it.each<EmptyKind>(["alerts", "results", "flights", "stopped"])("draws a scene for %s, hidden from screen readers", (kind) => {
    const { container } = render(
      <EmptyState kind={kind} title="Titre">
        Texte
      </EmptyState>,
    );

    const scene = container.querySelector("svg");
    expect(scene).toHaveAttribute("aria-hidden", "true");
    expect(scene?.querySelectorAll("circle, path, rect").length).toBeGreaterThan(2);
  });

  it("stops the radar of a collection that is stopped", () => {
    const turning = render(
      <EmptyState kind="alerts" title="a">
        b
      </EmptyState>,
    );
    const beamOfAlerts = turning.container.querySelector("path[class*=beam]")?.getAttribute("class");
    turning.unmount();
    const stopped = render(
      <EmptyState kind="stopped" title="a">
        b
      </EmptyState>,
    );
    const beamOfStopped = stopped.container.querySelector("path[class*=beam]")?.getAttribute("class");

    expect(beamOfAlerts).not.toMatch(/still/);
    expect(beamOfStopped).toMatch(/still/);
  });
});

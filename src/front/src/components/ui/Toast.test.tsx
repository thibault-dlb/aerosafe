import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithPreferences } from "@/test/preferences";

import Toast from "./Toast";

describe("Toast", () => {
  it("announces a success as a status", () => {
    renderWithPreferences(<Toast message="Alerte traitée." onDismiss={() => undefined} />);

    expect(screen.getByRole("status")).toHaveTextContent("Alerte traitée.");
  });

  it("announces an error as an alert", () => {
    renderWithPreferences(<Toast message="Enregistrement impossible." tone="error" onDismiss={() => undefined} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Enregistrement impossible.");
  });

  it("can be closed", () => {
    const onDismiss = vi.fn();
    renderWithPreferences(<Toast message="x" onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole("button", { name: "Fermer la notification" }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("runs its action and goes away", () => {
    const onAction = vi.fn();
    const onDismiss = vi.fn();
    renderWithPreferences(<Toast message="x" action={{ label: "Annuler", onAction }} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(onAction).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

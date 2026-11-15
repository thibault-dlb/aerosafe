import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderInApp } from "@/test/app";
import { fakeSession } from "@/test/auth";

import MyAccount from "./MyAccount";

function renderPage(role = "SUPERVISOR", preferences: Record<string, string> = {}) {
  return renderInApp(<MyAccount />, { session: fakeSession("authenticated", role), preferences });
}

describe("MyAccount", () => {
  it("shows who the visitor is", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Mon compte" })).toBeInTheDocument();
    const info = screen.getByRole("region", { name: "Informations" });
    expect(within(info).getByText("jane.doe@example.fr")).toBeInTheDocument();
    expect(within(info).getByText("Superviseur")).toBeInTheDocument();
    expect(within(info).getByText("JD")).toBeInTheDocument();
  });

  it("is open to a User too", () => {
    renderPage("USER");

    expect(within(screen.getByRole("region", { name: "Informations" })).getByText("Utilisateur")).toBeInTheDocument();
  });

  it("has the password form", () => {
    renderPage();

    const panel = screen.getByRole("region", { name: "Mot de passe" });
    expect(within(panel).getByLabelText("Mot de passe actuel")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Changer le mot de passe" })).toBeInTheDocument();
  });

  it("chooses the unit system, and says the thresholds stay metric", () => {
    renderPage("USER", { "aerosafe.units": "metric" });
    const metric = screen.getByRole("button", { name: "Métriques (m, km/h, km)" });
    const aeronautical = screen.getByRole("button", { name: "Aéronautiques (ft, kt, NM)" });
    expect(metric).toHaveAttribute("aria-pressed", "true");
    expect(aeronautical).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(aeronautical);

    expect(aeronautical).toHaveAttribute("aria-pressed", "true");
    expect(metric).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(/seuils des règles restent en unités métriques/)).toBeInTheDocument();
  });

  it("offers no choice of theme, the application is dark", () => {
    renderPage();

    expect(screen.queryByRole("group", { name: "Thème" })).not.toBeInTheDocument();
  });

  it("chooses the language, and the page follows", () => {
    renderPage();
    const group = within(screen.getByRole("group", { name: "Langue" }));

    fireEvent.click(group.getByRole("button", { name: "English" }));

    expect(screen.getByRole("heading", { level: 1, name: "My account" })).toBeInTheDocument();
  });

  it("asks for the password before deleting the account", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Supprimer mon compte" }));

    const dialog = screen.getByRole("dialog", { name: "Supprimer votre compte ?" });
    expect(within(dialog).getByLabelText("Votre mot de passe")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Annuler" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Account } from "@/models/Account";
import { renderWithPreferences } from "@/test/preferences";

import AccountTable from "./AccountTable";

const DATE = new Date("2026-11-09T10:00:00Z");
const ME = new Account("01ME", "me@example.fr", "SUPERVISOR", true, false, false, DATE);
const PILOT = new Account("01PILOT", "pilot@example.fr", "USER", true, false, false, DATE);
const PROVISIONAL = new Account("01NEW", "new@example.fr", "USER", true, true, false, DATE);
const OFF = new Account("01OFF", "off@example.fr", "USER", false, false, false, DATE);
const GONE = new Account("01GONE", "anonyme-01GONE@aerosafe.invalid", "USER", false, false, true, DATE);

function renderTable(accounts: Account[], busyId: string | null = null) {
  const handlers = { onRole: vi.fn(), onActive: vi.fn(), onAnonymise: vi.fn() };
  renderWithPreferences(<AccountTable accounts={accounts} currentId="01ME" busyId={busyId} {...handlers} />);
  return handlers;
}

function row(email: string) {
  return screen.getByRole("row", { name: (name) => name.includes(email) });
}

describe("AccountTable", () => {
  it("lists each account with its role, state and creation date", () => {
    renderTable([PILOT, OFF]);

    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Compte",
      "Rôle",
      "État",
      "Créé le",
      "Actions",
    ]);
    expect(within(row("pilot@example.fr")).getByRole("combobox", { name: "Rôle de pilot@example.fr" })).toHaveValue("USER");
    // The state, and the label of the switch that changes it.
    expect(within(row("pilot@example.fr")).getAllByText("Actif")).toHaveLength(2);
    expect(within(row("off@example.fr")).getByText("Désactivé")).toBeInTheDocument();
    expect(within(row("pilot@example.fr")).getByText(DATE.toLocaleString())).toBeInTheDocument();
  });

  it("changes a role, a state and asks to anonymise", () => {
    const { onRole, onActive, onAnonymise } = renderTable([PILOT]);
    const line = within(row("pilot@example.fr"));

    fireEvent.change(line.getByRole("combobox"), { target: { value: "SUPERVISOR" } });
    fireEvent.click(line.getByRole("switch", { name: "Compte actif : pilot@example.fr" }));
    fireEvent.click(line.getByRole("button", { name: "Anonymiser pilot@example.fr" }));

    expect(onRole).toHaveBeenCalledWith(PILOT, "SUPERVISOR");
    expect(onActive).toHaveBeenCalledWith(PILOT, false);
    expect(onAnonymise).toHaveBeenCalledWith(PILOT);
  });

  it("reactivates a deactivated account", () => {
    const { onActive } = renderTable([OFF]);

    fireEvent.click(screen.getByRole("switch", { name: "Compte actif : off@example.fr" }));

    expect(onActive).toHaveBeenCalledWith(OFF, true);
  });

  it("leaves the account of the Supervisor who looks without any control", () => {
    renderTable([ME]);
    const line = within(row("me@example.fr"));

    expect(line.getByText("vous")).toBeInTheDocument();
    expect(line.getByRole("combobox")).toBeDisabled();
    expect(line.getByRole("switch")).toBeDisabled();
    expect(line.getByRole("button", { name: /Anonymiser/ })).toBeDisabled();
  });

  it("greys an anonymised account and offers nothing on it", () => {
    renderTable([GONE]);
    const line = within(screen.getByRole("row", { name: /Compte anonymisé/ }));

    expect(line.getByText("Anonymisé")).toBeInTheDocument();
    expect(line.getByText("Compte anonymisé")).toHaveAttribute("title", "anonyme-01GONE@aerosafe.invalid");
    expect(line.getByRole("combobox")).toBeDisabled();
    expect(line.queryByRole("switch")).not.toBeInTheDocument();
    expect(line.queryByRole("button")).not.toBeInTheDocument();
  });

  it("says when a password is still the provisional one", () => {
    renderTable([PROVISIONAL, PILOT]);

    expect(within(row("new@example.fr")).getByText("Mot de passe provisoire")).toBeInTheDocument();
    expect(within(row("pilot@example.fr")).queryByText("Mot de passe provisoire")).not.toBeInTheDocument();
  });

  it("waits for the answer on the account being changed", () => {
    renderTable([PILOT, OFF], "01PILOT");

    expect(within(row("pilot@example.fr")).getByRole("switch")).toBeDisabled();
    expect(within(row("off@example.fr")).getByRole("switch")).toBeEnabled();
  });
});

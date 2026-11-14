import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Account, AccountPage, CreatedAccount } from "@/models/Account";
import { ApiError } from "@/services/ApiClient";
import type { UserService } from "@/services/UserService";
import { renderInApp } from "@/test/app";
import { fakeSession } from "@/test/auth";

import Accounts from "./Accounts";

const DATE = new Date("2026-11-09T10:00:00Z");
// The session of the tests is `fakeSession`: the account `01HZ`.
const ME = new Account("01HZ", "jane.doe@example.fr", "SUPERVISOR", true, false, false, DATE);
const PILOT = new Account("01PILOT", "pilot@example.fr", "USER", true, false, false, DATE);

function renderPage(overrides: Partial<Record<keyof UserService, unknown>> = {}) {
  const service = {
    list: vi.fn().mockResolvedValue(new AccountPage([ME, PILOT], 2)),
    create: vi.fn(),
    update: vi.fn(),
    anonymise: vi.fn(),
    ...overrides,
  } as unknown as UserService;
  renderInApp(<Accounts service={service} />, { session: fakeSession("authenticated", "SUPERVISOR") });
  return service as unknown as Record<"list" | "create" | "update" | "anonymise", ReturnType<typeof vi.fn>>;
}

describe("Accounts", () => {
  it("shows its title, what it does, and that it is loading", () => {
    renderPage({ list: vi.fn(() => new Promise(() => {})) });

    expect(screen.getByRole("heading", { level: 1, name: "Comptes" })).toBeInTheDocument();
    expect(screen.getByText(/Vous ne pouvez pas modifier votre propre compte/)).toBeInTheDocument();
    expect(screen.getByText("Chargement des comptes…")).toBeInTheDocument();
  });

  it("lists the accounts, the own one without controls", async () => {
    const api = renderPage();

    expect(await screen.findByRole("row", { name: /pilot@example\.fr/ })).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledWith({ search: undefined, limit: 20, offset: 0 });
    expect(within(screen.getByRole("row", { name: /jane\.doe@example\.fr/ })).getByRole("switch")).toBeDisabled();
    expect(within(screen.getByRole("row", { name: /pilot@example\.fr/ })).getByRole("switch")).toBeEnabled();
  });

  it("says when there is no account, or none matches", async () => {
    renderPage({ list: vi.fn().mockResolvedValue(new AccountPage([], 0)) });

    expect(await screen.findByText("Aucun compte")).toBeInTheDocument();
  });

  it("explains a failure to load", async () => {
    renderPage({ list: vi.fn().mockRejectedValue(new ApiError(500)) });

    expect(await screen.findByRole("alert")).toHaveTextContent("Le serveur est injoignable");
    expect(screen.queryByText("Chargement des comptes…")).not.toBeInTheDocument();
  });

  it("searches by e-mail address and starts again from the first page", async () => {
    const api = renderPage();
    await screen.findByRole("row", { name: /pilot@example\.fr/ });

    fireEvent.change(screen.getByLabelText("Rechercher un compte"), { target: { value: " pilot " } });
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));

    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ search: "pilot", limit: 20, offset: 0 }));
  });

  it("moves between the pages", async () => {
    const api = renderPage({ list: vi.fn().mockResolvedValue(new AccountPage([PILOT], 45)) });
    await screen.findByRole("row", { name: /pilot@example\.fr/ });

    fireEvent.click(screen.getByRole("button", { name: "Page suivante" }));

    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ search: undefined, limit: 20, offset: 20 }));
  });

  it("changes a role and says so", async () => {
    const api = renderPage();
    api.update.mockResolvedValue(new Account("01PILOT", "pilot@example.fr", "SUPERVISOR", true, false, false, DATE));
    await screen.findByRole("row", { name: /pilot@example\.fr/ });

    fireEvent.change(screen.getByRole("combobox", { name: "Rôle de pilot@example.fr" }), { target: { value: "SUPERVISOR" } });

    expect(await screen.findByText("pilot@example.fr est maintenant Superviseur.")).toBeInTheDocument();
    expect(api.update).toHaveBeenCalledWith("01PILOT", { role: "SUPERVISOR" });
    expect(screen.getByRole("combobox", { name: "Rôle de pilot@example.fr" })).toHaveValue("SUPERVISOR");
  });

  it("deactivates and reactivates an account", async () => {
    const api = renderPage();
    api.update
      .mockResolvedValueOnce(new Account("01PILOT", "pilot@example.fr", "USER", false, false, false, DATE))
      .mockResolvedValueOnce(PILOT);
    await screen.findByRole("row", { name: /pilot@example\.fr/ });
    const toggle = () => screen.getByRole("switch", { name: "Compte actif : pilot@example.fr" });

    fireEvent.click(toggle());
    expect(await screen.findByText("pilot@example.fr est désactivé : ses sessions sont fermées.")).toBeInTheDocument();
    expect(toggle()).toHaveAttribute("aria-checked", "false");

    fireEvent.click(toggle());
    expect(await screen.findByText("pilot@example.fr est réactivé.")).toBeInTheDocument();
    expect(api.update).toHaveBeenLastCalledWith("01PILOT", { is_active: true });
  });

  it.each([
    [403, "Vous ne pouvez pas modifier votre propre compte depuis cette liste."],
    [404, "Ce compte n'existe plus."],
    [409, /dernier Superviseur actif/],
  ])("explains a refused change (%i) and leaves the account as it was", async (status, message) => {
    const api = renderPage();
    api.update.mockRejectedValue(new ApiError(status));
    await screen.findByRole("row", { name: /pilot@example\.fr/ });

    fireEvent.click(screen.getByRole("switch", { name: "Compte actif : pilot@example.fr" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Compte actif : pilot@example.fr" })).toHaveAttribute("aria-checked", "true");
  });

  it("anonymises an account only after the word is typed", async () => {
    const api = renderPage();
    api.anonymise.mockResolvedValue(new Account("01PILOT", "anonyme-01PILOT@aerosafe.invalid", "USER", false, false, true, DATE));
    await screen.findByRole("row", { name: /pilot@example\.fr/ });

    fireEvent.click(screen.getByRole("button", { name: "Anonymiser pilot@example.fr" }));
    expect(api.anonymise).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Tapez ANONYMISER pour confirmer"), { target: { value: "ANONYMISER" } });
    fireEvent.click(screen.getByRole("button", { name: "Anonymiser le compte" }));

    expect(await screen.findByText("Le compte est anonymisé.")).toBeInTheDocument();
    expect(api.anonymise).toHaveBeenCalledWith("01PILOT");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const gone = screen.getByRole("row", { name: /Compte anonymisé/ });
    expect(within(gone).queryByRole("switch")).not.toBeInTheDocument();
  });

  it("explains a refused anonymisation and closes the question", async () => {
    const api = renderPage();
    api.anonymise.mockRejectedValue(new ApiError(409));
    await screen.findByRole("row", { name: /pilot@example\.fr/ });

    fireEvent.click(screen.getByRole("button", { name: "Anonymiser pilot@example.fr" }));
    fireEvent.change(screen.getByLabelText("Tapez ANONYMISER pour confirmer"), { target: { value: "ANONYMISER" } });
    fireEvent.click(screen.getByRole("button", { name: "Anonymiser le compte" }));

    expect(await screen.findByText(/dernier Superviseur actif/)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("creates an account, shows its password once, then reloads the list", async () => {
    const api = renderPage();
    api.create.mockResolvedValue(
      new CreatedAccount(new Account("01NEW", "new@example.fr", "USER", true, true, false, DATE), "ABCDE-FGHJK-MNPQR-STUVW"),
    );
    await screen.findByRole("row", { name: /pilot@example\.fr/ });

    fireEvent.click(screen.getByRole("button", { name: "Créer un compte" }));
    fireEvent.change(screen.getByLabelText("Adresse e-mail"), { target: { value: "new@example.fr" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer le compte" }));
    expect(await screen.findByText("ABCDE-FGHJK-MNPQR-STUVW")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Terminé" }));

    expect(await screen.findByText("Compte créé.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.create).toHaveBeenCalledWith("new@example.fr", "USER");
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
  });

  it("does not reload the list when the creation is cancelled", async () => {
    const api = renderPage();
    await screen.findByRole("row", { name: /pilot@example\.fr/ });

    fireEvent.click(screen.getByRole("button", { name: "Créer un compte" }));
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.list).toHaveBeenCalledTimes(1);
  });
});

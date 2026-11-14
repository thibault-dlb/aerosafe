import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Account, CreatedAccount } from "@/models/Account";
import { ApiError } from "@/services/ApiClient";
import type { UserService } from "@/services/UserService";
import { renderWithPreferences } from "@/test/preferences";

import CreateAccountDialog from "./CreateAccountDialog";

const PASSWORD = "ABCDE-FGHJK-MNPQR-STUVW";

function created(email = "new@example.fr", role = "USER") {
  return new CreatedAccount(new Account("01NEW", email, role, true, true, false, new Date()), PASSWORD);
}

function renderDialog(create: UserService["create"] = async () => created()) {
  const service = { create: vi.fn(create) } as unknown as UserService;
  const onClose = vi.fn();
  renderWithPreferences(<CreateAccountDialog open service={service} onClose={onClose} />);
  return { create: service.create as ReturnType<typeof vi.fn>, onClose };
}

function fill(email: string) {
  fireEvent.change(screen.getByLabelText("Adresse e-mail"), { target: { value: email } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CreateAccountDialog", () => {
  it("asks for an e-mail address and a role", () => {
    renderDialog();

    expect(screen.getByRole("dialog", { name: "Créer un compte" })).toBeInTheDocument();
    expect(screen.getByLabelText("Rôle")).toHaveValue("USER");
    expect(screen.getByText(/Un mot de passe provisoire est généré/)).toBeInTheDocument();
  });

  it("refuses an address that is not one, without calling the API", () => {
    const { create } = renderDialog();

    fill("not an address");
    fireEvent.click(screen.getByRole("button", { name: "Créer le compte" }));

    expect(screen.getByText("Saisissez une adresse e-mail valide.")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("creates the account and shows its provisional password", async () => {
    const { create } = renderDialog(async () => created("new@example.fr", "SUPERVISOR"));

    fill(" new@example.fr ");
    fireEvent.change(screen.getByLabelText("Rôle"), { target: { value: "SUPERVISOR" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer le compte" }));

    expect(await screen.findByRole("dialog", { name: "Compte créé" })).toBeInTheDocument();
    expect(create).toHaveBeenCalledWith("new@example.fr", "SUPERVISOR");
    expect(screen.getByText(PASSWORD)).toBeInTheDocument();
    expect(screen.getByText(/Transmettez ce mot de passe provisoire à new@example\.fr/)).toBeInTheDocument();
  });

  it("copies the password", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    renderDialog();
    fill("new@example.fr");
    fireEvent.click(screen.getByRole("button", { name: "Créer le compte" }));

    fireEvent.click(await screen.findByRole("button", { name: "Copier" }));

    expect(writeText).toHaveBeenCalledWith(PASSWORD);
    expect(await screen.findByRole("button", { name: "Copié" })).toBeInTheDocument();
  });

  it("keeps the password on screen when the clipboard is refused", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: vi.fn().mockRejectedValue(new Error("no")) } });
    renderDialog();
    fill("new@example.fr");
    fireEvent.click(screen.getByRole("button", { name: "Créer le compte" }));

    fireEvent.click(await screen.findByRole("button", { name: "Copier" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Copier" })).toBeInTheDocument());
    expect(screen.getByText(PASSWORD)).toBeInTheDocument();
  });

  it("tells the list to reload when it is closed after a creation", async () => {
    const { onClose } = renderDialog();
    fill("new@example.fr");
    fireEvent.click(screen.getByRole("button", { name: "Créer le compte" }));

    fireEvent.click(await screen.findByRole("button", { name: "Terminé" }));

    expect(onClose).toHaveBeenCalledWith(true);
  });

  it("tells it nothing was made when it is cancelled", () => {
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(onClose).toHaveBeenCalledWith(false);
  });

  it.each([
    [409, "Cet e-mail a déjà un compte."],
    [422, /Vérifiez l'adresse e-mail/],
    [500, "Le serveur est injoignable. Réessayez plus tard."],
  ])("explains a %i answer and stays on the form", async (status, message) => {
    renderDialog(async () => {
      throw new ApiError(status);
    });
    fill("new@example.fr");

    fireEvent.click(screen.getByRole("button", { name: "Créer le compte" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("dialog", { name: "Créer un compte" })).toBeInTheDocument();
  });
});

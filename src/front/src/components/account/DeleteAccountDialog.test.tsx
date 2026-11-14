import { fireEvent, screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/services/ApiClient";
import { renderInApp } from "@/test/app";
import { fakeSession } from "@/test/auth";

import DeleteAccountDialog from "./DeleteAccountDialog";

function renderDialog(deleteAccount = vi.fn().mockResolvedValue(undefined)) {
  const onClose = vi.fn();
  renderInApp(
    <Routes>
      <Route path="/account" element={<DeleteAccountDialog open onClose={onClose} />} />
      <Route path="/" element={<h1>Home</h1>} />
    </Routes>,
    { path: "/account", session: fakeSession("authenticated", "USER", { deleteAccount }) },
  );
  return { deleteAccount, onClose };
}

function confirm(password: string) {
  fireEvent.change(screen.getByLabelText("Votre mot de passe"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Supprimer définitivement" }));
}

describe("DeleteAccountDialog", () => {
  it("warns that it cannot be undone", () => {
    renderDialog();

    expect(screen.getByRole("dialog", { name: "Supprimer votre compte ?" })).toBeInTheDocument();
    expect(screen.getByText(/Cette action est irréversible/)).toBeInTheDocument();
  });

  it("deletes the account with the password, says so and goes home", async () => {
    const { deleteAccount } = renderDialog();

    confirm("my password!");

    expect(await screen.findByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(deleteAccount).toHaveBeenCalledWith("my password!");
    expect(screen.getByText("Votre compte est supprimé.")).toBeInTheDocument();
  });

  it("asks for the password without calling the API", () => {
    const { deleteAccount } = renderDialog();

    confirm("");

    expect(screen.getByRole("alert")).toHaveTextContent("Saisissez votre mot de passe actuel.");
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it.each([
    [400, "Mot de passe incorrect."],
    [409, /dernier Superviseur actif/],
    [429, /Trop d'échecs/],
  ])("explains a %i answer and stays on the question", async (status, message) => {
    renderDialog(vi.fn().mockRejectedValue(new ApiError(status)));

    confirm("my password!");

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes on cancel and forgets the password and the failure", () => {
    const { onClose } = renderDialog();
    fireEvent.change(screen.getByLabelText("Votre mot de passe"), { target: { value: "x" } });

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});

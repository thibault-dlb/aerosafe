import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { User } from "@/models/User";
import { renderInApp } from "@/test/app";
import { fakeSession } from "@/test/auth";

import ChangePassword from "./ChangePassword";

function renderScreen(overrides = {}) {
  return renderInApp(<ChangePassword />, {
    session: fakeSession("authenticated", "USER", overrides),
  });
}

describe("ChangePassword", () => {
  it("tells why the password must be replaced and for which account", () => {
    renderScreen();

    expect(screen.getByRole("heading", { level: 1, name: "Choisissez votre mot de passe" })).toBeInTheDocument();
    expect(screen.getByText(/Un Superviseur a créé votre compte avec un mot de passe provisoire/)).toBeInTheDocument();
    expect(screen.getByText("jane.doe@example.fr")).toBeInTheDocument();
  });

  it("is always dark, whatever the theme", () => {
    const { container } = renderScreen();

    expect(container.firstElementChild).toHaveClass("darkScope");
  });

  it("replaces the password with the form of the account page", async () => {
    const changePassword = vi.fn().mockResolvedValue(new User("01HZ", "jane.doe@example.fr", "USER", true));
    renderScreen({ changePassword });

    fireEvent.change(screen.getByLabelText("Mot de passe actuel"), { target: { value: "ABCDE-FGHJK-MNPQR-STUVW" } });
    fireEvent.change(screen.getByLabelText("Nouveau mot de passe"), { target: { value: "a new long password" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));

    expect(await screen.findByText(/Mot de passe changé/)).toBeInTheDocument();
    expect(changePassword).toHaveBeenCalledWith("ABCDE-FGHJK-MNPQR-STUVW", "a new long password");
  });

  it("lets the owner leave instead", () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    renderScreen({ logout });

    fireEvent.click(screen.getByRole("button", { name: "Se déconnecter" }));

    expect(logout).toHaveBeenCalledOnce();
  });
});

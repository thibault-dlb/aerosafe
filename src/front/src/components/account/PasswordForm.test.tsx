import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { User } from "@/models/User";
import { ApiError } from "@/services/ApiClient";
import { renderInApp } from "@/test/app";
import { fakeSession } from "@/test/auth";

import PasswordForm from "./PasswordForm";

function renderForm(changePassword = vi.fn().mockResolvedValue(new User("01HZ", "jane@example.fr", "USER", true))) {
  renderInApp(<PasswordForm submitLabel="account.password.submit" />, {
    session: fakeSession("authenticated", "USER", { changePassword }),
  });
  return changePassword;
}

function fill(current: string, next: string) {
  fireEvent.change(screen.getByLabelText("Mot de passe actuel"), { target: { value: current } });
  fireEvent.change(screen.getByLabelText("Nouveau mot de passe"), { target: { value: next } });
  fireEvent.click(screen.getByRole("button", { name: "Changer le mot de passe" }));
}

describe("PasswordForm", () => {
  it("asks for the current password and the new one", () => {
    renderForm();

    expect(screen.getByLabelText("Mot de passe actuel")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByLabelText("Nouveau mot de passe")).toHaveAttribute("autocomplete", "new-password");
  });

  it("changes the password, says so and empties the fields", async () => {
    const changePassword = renderForm();

    fill("old password!", "a new long password");

    expect(await screen.findByText(/Mot de passe changé/)).toBeInTheDocument();
    expect(changePassword).toHaveBeenCalledWith("old password!", "a new long password");
    await waitFor(() => expect(screen.getByLabelText("Mot de passe actuel")).toHaveValue(""));
    expect(screen.getByLabelText("Nouveau mot de passe")).toHaveValue("");
  });

  it("asks for what is missing without calling the API", () => {
    const changePassword = renderForm();

    fill("", "short");

    expect(screen.getByText("Saisissez votre mot de passe actuel.")).toBeInTheDocument();
    expect(screen.getByLabelText("Mot de passe actuel")).toBeInvalid();
    expect(screen.getByLabelText("Nouveau mot de passe")).toBeInvalid();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it.each([
    [400, "Le mot de passe actuel est incorrect."],
    [422, /doit faire 12 caractères au minimum et différer/],
    [429, /Trop d'échecs/],
    [500, /injoignable/],
  ])("explains a %i answer and keeps what was typed", async (status, message) => {
    renderForm(vi.fn().mockRejectedValue(new ApiError(status)));

    fill("old password!", "a new long password");

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByLabelText("Nouveau mot de passe")).toHaveValue("a new long password");
  });

  it("clears the failure at the next attempt", async () => {
    const changePassword = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(400))
      .mockResolvedValueOnce(new User("01HZ", "jane@example.fr", "USER", true));
    renderForm(changePassword);

    fill("old password!", "a new long password");
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Changer le mot de passe" }));

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
});

import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Account } from "@/models/Account";
import { renderWithPreferences } from "@/test/preferences";

import AnonymiseDialog from "./AnonymiseDialog";

const PILOT = new Account("01PILOT", "pilot@example.fr", "USER", true, false, false, new Date("2026-11-09T10:00:00Z"));

function renderDialog(account: Account | null = PILOT, busy = false) {
  const handlers = { onConfirm: vi.fn(), onClose: vi.fn() };
  const view = renderWithPreferences(<AnonymiseDialog account={account} busy={busy} {...handlers} />);
  return { ...handlers, ...view };
}

describe("AnonymiseDialog", () => {
  it("is closed while there is no account to anonymise", () => {
    renderDialog(null);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says what will be erased and that it cannot be undone", () => {
    renderDialog();

    expect(screen.getByRole("dialog", { name: "Anonymiser ce compte ?" })).toBeInTheDocument();
    expect(screen.getByText(/pilot@example\.fr seront effacés/)).toBeInTheDocument();
    expect(screen.getByText(/irréversible/)).toBeInTheDocument();
  });

  it("needs the word typed before it anonymises", () => {
    const { onConfirm } = renderDialog();
    const button = screen.getByRole("button", { name: "Anonymiser le compte" });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Tapez ANONYMISER pour confirmer"), { target: { value: "anonym" } });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Tapez ANONYMISER pour confirmer"), { target: { value: " anonymiser " } });
    expect(button).toBeEnabled();
    fireEvent.click(button);

    expect(onConfirm).toHaveBeenCalledWith(PILOT);
  });

  it("does not anonymise while another change is under way", () => {
    renderDialog(PILOT, true);

    fireEvent.change(screen.getByLabelText("Tapez ANONYMISER pour confirmer"), { target: { value: "ANONYMISER" } });

    expect(screen.getByRole("button", { name: "Anonymiser le compte" })).toBeDisabled();
  });

  it("closes on cancel and forgets what was typed", () => {
    const { onClose, rerender } = renderDialog();
    fireEvent.change(screen.getByLabelText("Tapez ANONYMISER pour confirmer"), { target: { value: "ANONYMISER" } });

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(onClose).toHaveBeenCalledOnce();
    rerender(<AnonymiseDialog account={PILOT} busy={false} onConfirm={vi.fn()} onClose={onClose} />);
    expect(screen.getByLabelText("Tapez ANONYMISER pour confirmer")).toHaveValue("");
  });
});

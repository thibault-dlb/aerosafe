import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithPreferences } from "@/test/preferences";

import Dialog, { type DialogProps } from "./Dialog";

function ui(overrides: Partial<DialogProps> = {}) {
  return (
    <Dialog
      open
      title="Anonymiser ce compte ?"
      onClose={() => undefined}
      actions={
        <>
          <button type="button">Annuler</button>
          <button type="button">Anonymiser</button>
        </>
      }
      {...overrides}
    >
      <p>Action irréversible.</p>
      <input aria-label="Confirmation" />
    </Dialog>
  );
}

describe("Dialog", () => {
  it("is a modal dialog named by its title", () => {
    renderWithPreferences(ui());

    const dialog = screen.getByRole("dialog", { name: "Anonymiser ce compte ?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Action irréversible.")).toBeInTheDocument();
  });

  it("shows nothing while closed", () => {
    renderWithPreferences(ui({ open: false }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("puts the focus inside when it opens and gives it back when it closes", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const view = renderWithPreferences(ui({ open: false }));

    view.rerender(ui({ open: true }));
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);

    view.rerender(ui({ open: false }));
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("closes with Escape, the close button and a click on the backdrop, but not on the window itself", () => {
    const onClose = vi.fn();
    renderWithPreferences(ui({ onClose }));

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    fireEvent.mouseDown(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.mouseDown(screen.getByRole("dialog").parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("keeps the focus inside: Tab loops from the last button to the first control, and back", () => {
    renderWithPreferences(ui());
    const close = screen.getByRole("button", { name: "Fermer" });
    const last = screen.getByRole("button", { name: "Anonymiser" });

    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(close).toHaveFocus();

    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });

  it("lets Tab move on normally in the middle, and ignores the other keys", () => {
    renderWithPreferences(ui());
    const input = screen.getByLabelText("Confirmation");
    input.focus();

    const tab = fireEvent.keyDown(input, { key: "Tab" });
    const letter = fireEvent.keyDown(input, { key: "a" });

    expect(tab).toBe(true);
    expect(letter).toBe(true);
    expect(input).toHaveFocus();
  });

  it("marks a destructive action and does not scroll the page behind it", () => {
    const view = renderWithPreferences(ui({ tone: "danger", icon: "anonymous" }));

    expect(screen.getByRole("dialog").className).toMatch(/danger/);
    expect(document.body.style.overflow).toBe("hidden");

    view.unmount();
    expect(document.body.style.overflow).toBe("");
  });
});

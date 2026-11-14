import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PreferencesProvider from "@/providers/PreferencesProvider";
import { PreferenceStore } from "@/services/PreferenceStore";

import LengthGauge from "./LengthGauge";
import PasswordField from "./PasswordField";

function renderField(props: Partial<Parameters<typeof PasswordField>[0]> = {}) {
  return render(
    <PreferencesProvider store={new PreferenceStore(null)}>
      <PasswordField label="Mot de passe" value="" onChange={() => undefined} {...props} />
    </PreferencesProvider>,
  );
}

describe("PasswordField", () => {
  it("hides the password, and shows it on request", () => {
    renderField({ value: "secret" });
    const input = screen.getByLabelText("Mot de passe");
    expect(input).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Afficher le mot de passe" }));

    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Masquer le mot de passe" })).toHaveAttribute("aria-pressed", "true");
  });

  it("limits the length to what the API accepts", () => {
    renderField();

    expect(screen.getByLabelText("Mot de passe")).toHaveAttribute("maxLength", "128");
  });

  it("warns while Caps Lock is on, and stops when it is off or the field loses the focus", () => {
    renderField();
    const input = screen.getByLabelText("Mot de passe");
    // The warning is always in the page, folded away: it is open when nothing makes it inert.
    const warning = () => screen.getByText("Verrouillage majuscule activé").closest("[inert]");
    expect(warning()).not.toBeNull();

    fireEvent.keyDown(input, { key: "A", modifierCapsLock: true });
    expect(warning()).toBeNull();

    fireEvent.keyUp(input, { key: "CapsLock", modifierCapsLock: false });
    expect(warning()).not.toBeNull();

    fireEvent.keyUp(input, { key: "a", modifierCapsLock: true });
    expect(warning()).toBeNull();
    fireEvent.blur(input);
    expect(warning()).not.toBeNull();
  });

  it("still gives the key and blur events to the page", () => {
    const onKeyDown = vi.fn();
    const onKeyUp = vi.fn();
    const onBlur = vi.fn();
    renderField({ onKeyDown, onKeyUp, onBlur });
    const input = screen.getByLabelText("Mot de passe");

    fireEvent.keyDown(input, { key: "a" });
    fireEvent.keyUp(input, { key: "a" });
    fireEvent.blur(input);

    expect(onKeyDown).toHaveBeenCalledOnce();
    expect(onKeyUp).toHaveBeenCalledOnce();
    expect(onBlur).toHaveBeenCalledOnce();
  });

  it("shows the length gauge only when asked to", () => {
    const { unmount } = renderField({ value: "abc" });
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    unmount();

    renderField({ value: "abc", gauge: true });

    expect(screen.getByRole("meter", { name: "Longueur du mot de passe" })).toHaveAttribute("aria-valuenow", "3");
  });
});

describe("LengthGauge", () => {
  function renderGauge(length: number) {
    return render(
      <PreferencesProvider store={new PreferenceStore(null)}>
        <LengthGauge length={length} />
      </PreferencesProvider>,
    );
  }

  it("counts the characters and asks for 12", () => {
    renderGauge(5);

    expect(screen.getByText("5 / 12")).toBeInTheDocument();
    expect(screen.getByText("12 caractères au minimum")).toBeInTheDocument();
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "5");
  });

  it("says the length is enough from 12 characters on, and keeps counting", () => {
    renderGauge(14);

    expect(screen.getByText("Longueur suffisante")).toBeInTheDocument();
    expect(screen.getByText("14 / 12")).toBeInTheDocument();
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "12");
  });
});

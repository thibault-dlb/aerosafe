import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PreferencesProvider from "@/providers/PreferencesProvider";
import { PreferenceStore } from "@/services/PreferenceStore";

import LanguageSwitch from "./LanguageSwitch";

describe("LanguageSwitch", () => {
  it("offers both languages, French first", () => {
    render(
      <PreferencesProvider store={new PreferenceStore(null)}>
        <LanguageSwitch />
      </PreferencesProvider>,
    );

    expect(screen.getByRole("group", { name: "Langue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Français" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "false");
  });

  it("switches the language", () => {
    render(
      <PreferencesProvider store={new PreferenceStore(null)}>
        <LanguageSwitch />
      </PreferencesProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "English" }));

    expect(screen.getByRole("group", { name: "Language" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
  });
});

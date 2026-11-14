import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PreferencesProvider from "@/providers/PreferencesProvider";
import { PreferenceStore } from "@/services/PreferenceStore";

import SessionLoading from "./SessionLoading";

describe("SessionLoading", () => {
  it("tells that the session is opening, in the language of the visitor", () => {
    render(
      <PreferencesProvider store={new PreferenceStore(null)}>
        <SessionLoading />
      </PreferencesProvider>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Ouverture de la session…");
  });

  it("draws the eye of the logo as a decoration", () => {
    const { container } = render(
      <PreferencesProvider store={new PreferenceStore(null)}>
        <SessionLoading />
      </PreferencesProvider>,
    );

    const eye = container.querySelector("svg");
    expect(eye).toHaveAttribute("aria-hidden", "true");
    expect(eye?.querySelectorAll("path").length).toBeGreaterThanOrEqual(4);
  });
});

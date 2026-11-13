import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { useTranslation } from "@/hooks/useTranslation";
import PreferencesProvider from "@/providers/PreferencesProvider";
import { PreferenceStore } from "@/services/PreferenceStore";

import Home from "./Home";

function memoryStore(): PreferenceStore {
  const values = new Map<string, string>();
  return new PreferenceStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  });
}

function EnglishButton() {
  const { setLanguage } = useTranslation();
  return <button onClick={() => setLanguage("en")}>en</button>;
}

async function renderHome() {
  render(
    <PreferencesProvider store={memoryStore()}>
      <MemoryRouter>
        <EnglishButton />
        <Home />
      </MemoryRouter>
    </PreferencesProvider>,
  );
  await act(async () => {});
}

describe("Home", () => {
  it("shows the application name", async () => {
    await renderHome();

    expect(screen.getByRole("heading", { level: 1, name: "AeroSafe" })).toBeInTheDocument();
  });

  it("does not carry the educational notice: the footer and the log in pages do", async () => {
    await renderHome();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText(/pédagogique/)).not.toBeInTheDocument();
  });

  it("leads to the main screens", async () => {
    await renderHome();

    for (const [name, href] of [
      ["Rechercher un aéronef", "/aircraft"],
      ["Aéronefs", "/aircraft"],
      ["Tableau de bord", "/dashboard"],
      ["Alertes", "/alerts"],
      ["Règles", "/rules"],
    ] as const) {
      expect(screen.getByRole("link", { name: new RegExp(`^${name}`) })).toHaveAttribute("href", href);
    }
  });

  it("is in French by default and follows the language", async () => {
    await renderHome();
    expect(screen.getByText("Surveillance des données aéronautiques en direct")).toBeInTheDocument();

    fireEvent.click(screen.getByText("en"));

    expect(screen.getByText("Live aeronautical data monitoring")).toBeInTheDocument();
  });
});

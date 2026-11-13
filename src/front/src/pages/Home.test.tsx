import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { useTranslation } from "@/hooks/useTranslation";
import PreferencesProvider from "@/providers/PreferencesProvider";
import { PreferenceStore } from "@/services/PreferenceStore";

vi.mock("@/hooks/useScrollProgress", () => ({ useScrollProgress: () => 0 }));

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

  it("leads to the main screens, from the hero, the features and the closing band", async () => {
    await renderHome();

    for (const [name, href, count] of [
      ["Ouvrir le tableau de bord", "/dashboard", 3],
      ["Se connecter", "/login", 2],
      ["Rechercher un aéronef", "/aircraft", 1],
      ["Voir les alertes", "/alerts", 1],
      ["Régler les règles", "/rules", 1],
    ] as const) {
      const links = screen.getAllByRole("link", { name, hidden: true });
      expect(links).toHaveLength(count);
      links.forEach((link) => expect(link).toHaveAttribute("href", href));
    }
  });

  it("runs from the scene to the closing band", async () => {
    await renderHome();

    const headings = screen.getAllByRole("heading", { level: 2, hidden: true }).map((item) => item.textContent);
    expect(headings).toEqual([
      "Suivre.",
      "Détecter.",
      "Tout pour garder le contrôle du ciel.",
      "Comment ça marche",
      "Prêt à surveiller le ciel ?",
    ]);
  });

  it("is in French by default and follows the language", async () => {
    await renderHome();
    expect(screen.getByText("Chaque vol, surveillé. Chaque écart, détecté.")).toBeInTheDocument();

    fireEvent.click(screen.getByText("en"));

    expect(screen.getByText("Every flight, watched. Every deviation, caught.")).toBeInTheDocument();
  });
});

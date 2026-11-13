import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTranslation } from "@/hooks/useTranslation";
import PreferencesProvider from "@/providers/PreferencesProvider";
import { PreferenceStore } from "@/services/PreferenceStore";

const { progress } = vi.hoisted(() => ({ progress: { value: 0 } }));
vi.mock("@/hooks/useScrollProgress", () => ({ useScrollProgress: () => progress.value }));

import HomeHero from "./HomeHero";

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

function renderHero() {
  return render(
    <PreferencesProvider store={memoryStore()}>
      <MemoryRouter>
        <EnglishButton />
        <HomeHero />
      </MemoryRouter>
    </PreferencesProvider>,
  );
}

beforeEach(() => {
  progress.value = 0;
});

describe("HomeHero", () => {
  it("opens on the name, the promise and the two ways in", () => {
    renderHero();

    expect(screen.getByRole("heading", { level: 1, name: "AeroSafe" })).toBeInTheDocument();
    expect(screen.getByText("Chaque vol, surveillé. Chaque écart, détecté.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ouvrir le tableau de bord" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Se connecter" })).toHaveAttribute("href", "/login");
  });

  it("describes the animation for screen readers", () => {
    renderHero();

    expect(screen.getByRole("img", { name: /un aéronef traverse la France/ })).toBeInTheDocument();
  });

  it("draws the map, the cities and the callsign of the aircraft", () => {
    renderHero();

    for (const city of ["Paris", "Lyon", "Marseille", "Nice"]) {
      expect(screen.getByText(city)).toBeInTheDocument();
    }
    expect(screen.getAllByText("ASF2041").length).toBeGreaterThan(0);
  });

  it("shows no alert while the title is on screen", () => {
    renderHero();

    expect(screen.getByText("Nominal")).toBeInTheDocument();
    expect(screen.queryByText("Alerte R3")).not.toBeInTheDocument();
  });

  it("raises the alert of rule R3 at the end of the scroll", () => {
    progress.value = 1;
    renderHero();

    expect(screen.getByText("Alerte R3")).toBeInTheDocument();
    expect(screen.getByText("Variation d'altitude importante")).toBeInTheDocument();
    expect(screen.getByText(/-45 m\/s · seuil 30 m\/s/)).toBeInTheDocument();
  });

  it("writes the readings of the aircraft", () => {
    progress.value = 0.5;
    renderHero();

    for (const label of ["Altitude", "Taux vertical", "Vitesse sol", "Cap"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("LFPG → LFMN")).toBeInTheDocument();
  });

  it("follows the language", () => {
    progress.value = 1;
    renderHero();

    fireEvent.click(screen.getByText("en"));

    expect(screen.getByText("Every flight, watched. Every deviation, caught.")).toBeInTheDocument();
    expect(screen.getByText("Alert R3")).toBeInTheDocument();
    expect(screen.getByText("Open the dashboard")).toHaveAttribute("href", "/dashboard");
  });
});

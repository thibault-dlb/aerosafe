import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { useTranslation } from "@/hooks/useTranslation";
import PreferencesProvider from "@/providers/PreferencesProvider";
import { DataModeService } from "@/services/DataModeService";
import { PreferenceStore } from "@/services/PreferenceStore";

import HomeCta from "./HomeCta";
import HomeFeatures from "./HomeFeatures";
import { FIGURES } from "./figures";
import HomeFigures from "./HomeFigures";
import HomeSteps from "./HomeSteps";
import HomeVignette, { type VignetteKind } from "./HomeVignettes";

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

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderSection(section: ReactNode, store = memoryStore()) {
  return render(
    <PreferencesProvider store={store}>
      <MemoryRouter>
        <EnglishButton />
        <Where />
        {section}
      </MemoryRouter>
    </PreferencesProvider>,
  );
}

afterEach(() => DataModeService.reset());

describe("HomeFeatures", () => {
  it("presents the four features, each leading to its page", () => {
    renderSection(<HomeFeatures />);

    const headings = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(headings).toEqual([
      "Chaque aéronef, en un coup d'œil",
      "Chaque écart devient une alerte",
      "Des seuils à votre mesure",
      "Rejouez une année de trafic",
    ]);
    for (const [name, href] of [
      ["Rechercher un aéronef", "/aircraft"],
      ["Voir les alertes", "/alerts"],
      ["Régler les règles", "/rules"],
      ["Ouvrir le tableau de bord", "/dashboard"],
    ] as const) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
  });

  it("switches to the replay when the replay link is followed, and opens the dashboard", () => {
    const store = memoryStore();
    renderSection(<HomeFeatures />, store);
    expect(store.get(DataModeService.KEY)).toBeNull();

    fireEvent.click(screen.getByRole("link", { name: "Ouvrir le tableau de bord" }));

    expect(store.get(DataModeService.KEY)).toBe("replay");
    expect(screen.getByTestId("where")).toHaveTextContent("/dashboard");
  });

  it.each(["Rechercher un aéronef", "Voir les alertes", "Régler les règles"])(
    "leaves the data mode alone when %s is followed",
    (name) => {
      const store = memoryStore();
      renderSection(<HomeFeatures />, store);

      fireEvent.click(screen.getByRole("link", { name }));

      expect(store.get(DataModeService.KEY)).toBeNull();
    },
  );

  it("is a section with a title", () => {
    renderSection(<HomeFeatures />);

    expect(screen.getByRole("region", { name: "Tout pour garder le contrôle du ciel." })).toBeInTheDocument();
  });

  it("follows the language", () => {
    renderSection(<HomeFeatures />);

    fireEvent.click(screen.getByText("en"));

    expect(screen.getByRole("link", { name: "See the alerts" })).toHaveAttribute("href", "/alerts");
  });
});

describe("HomeFigures", () => {
  it("gives every figure in full for screen readers", () => {
    renderSection(<HomeFigures />);

    const section = screen.getByRole("region", { name: "AeroSafe en chiffres" });
    for (const figure of FIGURES) {
      const text = new Intl.NumberFormat("fr").format(figure.value);
      expect(within(section).getByText(text, { selector: ".visually-hidden" })).toBeInTheDocument();
    }
  });

  it("names what each figure counts", () => {
    renderSection(<HomeFigures />);

    expect(screen.getByText("règles de détection")).toBeInTheDocument();
    expect(screen.getByText("jours de trafic rejouable")).toBeInTheDocument();
  });

  it("states figures that the documentation backs", () => {
    expect(FIGURES.map((figure) => figure.value)).toEqual([30, 5, 856, 365]);
  });

  it("follows the language", () => {
    renderSection(<HomeFigures />);

    fireEvent.click(screen.getByText("en"));

    expect(screen.getByRole("region", { name: "AeroSafe in figures" })).toBeInTheDocument();
    expect(screen.getByText("detection rules")).toBeInTheDocument();
  });
});

describe("HomeSteps", () => {
  it("tells the four steps in order", () => {
    renderSection(<HomeSteps />);

    const steps = screen.getAllByRole("listitem").map((item) => within(item).getByRole("heading").textContent);
    expect(steps).toEqual(["Collecter", "Détecter", "Alerter", "Analyser"]);
    expect(screen.getByRole("heading", { level: 2, name: "Comment ça marche" })).toBeInTheDocument();
  });

  it("follows the language", () => {
    renderSection(<HomeSteps />);

    fireEvent.click(screen.getByText("en"));

    expect(screen.getByRole("heading", { level: 2, name: "How it works" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Analyse" })).toBeInTheDocument();
  });
});

describe("HomeCta", () => {
  it("closes the page with the two ways into the application", () => {
    renderSection(<HomeCta />);

    expect(screen.getByRole("heading", { level: 2, name: "Prêt à surveiller le ciel ?" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ouvrir le tableau de bord" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Se connecter" })).toHaveAttribute("href", "/login");
  });

  it("follows the language", () => {
    renderSection(<HomeCta />);

    fireEvent.click(screen.getByText("en"));

    expect(screen.getByRole("heading", { name: "Ready to watch the sky?" })).toBeInTheDocument();
  });
});

describe("HomeVignette", () => {
  const CONTENT: [VignetteKind, string][] = [
    ["aircraft", "3944EE"],
    ["alerts", "R3"],
    ["rules", "R4"],
    ["replay", "14:32 UTC"],
  ];

  it.each(CONTENT)("draws the %s feature, hidden from screen readers", (kind, text) => {
    const { container } = render(<HomeVignette kind={kind} />);

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText(text)).toBeInTheDocument();
  });
});

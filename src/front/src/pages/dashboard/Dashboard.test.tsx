import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { Aircraft } from "@/models/Aircraft";
import { Alert } from "@/models/Alert";
import { CollectionRun, CollectionSummary, Dashboard as DashboardData, DashboardStatistics, StatisticsSlice } from "@/models/Dashboard";
import { ApiError } from "@/services/ApiClient";
import type { AlertService } from "@/services/AlertService";
import type { CollectionService } from "@/services/CollectionService";
import type { DashboardService } from "@/services/DashboardService";
import { renderInApp } from "@/test/app";
import { fakeSession } from "@/test/auth";

import Dashboard from "./Dashboard";

const T0 = new Date("2026-11-14T10:00:00Z");
const ALERT = new Alert("01A", "R1", T0, "R1 delay", "01AIRCRAFT", "3c6444", null, "Délai", 420, 300, "s", "HIGH");
const AIRCRAFT = new Aircraft("01AIRCRAFT", "3c6444", "F-GKXA", null, null, T0, 48.8, 2.3, 9000, 90, false);
const COLLECTION = new CollectionSummary(true, false, false, T0, 3900, [new CollectionRun(T0, "SUCCESS")]);
const DASHBOARD = new DashboardData(4, 9, 17, [ALERT], COLLECTION, [ALERT]);
const STATISTICS = new DashboardStatistics("24h", "hour", 3, [new StatisticsSlice(T0, 3, { R1: 3 })]);

function services(overrides: Partial<Record<"load" | "statistics" | "trackedAircraft" | "flightOf", unknown>> = {}) {
  return {
    flightOf: vi.fn().mockResolvedValue([
      { at: T0.getTime() - 600_000, lat: 48.7, lon: 2.1, altitude: 8000 },
      { at: T0.getTime(), lat: 48.8, lon: 2.3, altitude: 9000 },
    ]),
    load: vi.fn().mockResolvedValue(DASHBOARD),
    statistics: vi.fn().mockResolvedValue(STATISTICS),
    trackedAircraft: vi.fn().mockResolvedValue([AIRCRAFT]),
    ...overrides,
  } as unknown as DashboardService;
}

function renderDashboard(
  role: string,
  service: DashboardService = services(),
  extra: { alerts?: AlertService; collection?: CollectionService } = {},
) {
  renderInApp(<Dashboard service={service} alertService={extra.alerts} collectionService={extra.collection} />, {
    session: fakeSession("authenticated", role),
  });
  return service;
}

/** Shows where the router is, so a test can see a page send the visitor elsewhere. */
function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{pathname + search}</p>;
}

function renderWithLocation(role: string, service: DashboardService = services()) {
  renderInApp(
    <>
      <Dashboard service={service} />
      <Where />
    </>,
    { session: fakeSession("authenticated", role) },
  );
}

const CENTRE = "Centrer la carte sur 3c6444 (alerte R1)";
const OPEN = "Ouvrir l'alerte R1 de 3c6444 dans les alertes";

describe("Dashboard", () => {
  it("shows the figures, the active alerts, the chart and the collection", async () => {
    renderDashboard("USER");

    expect(await screen.findByRole("heading", { level: 1, name: "Tableau de bord" })).toBeInTheDocument();
    expect(await screen.findByText("Aéronefs suivis")).toBeInTheDocument();
    expect(screen.getByText("À traiter")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Alertes actives" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Alertes par règle" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Collecte OpenSky" })).toBeInTheDocument();
  });

  it("is read only for a User: no processing, no link, no control", async () => {
    renderDashboard("USER");

    await screen.findByRole("region", { name: "Alertes actives" });
    expect(screen.queryByRole("button", { name: /Marquer l'alerte R1/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /alertes actives/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mettre en pause" })).not.toBeInTheDocument();
  });

  it("lets a Supervisor process an alert", async () => {
    const process = vi.fn().mockResolvedValue(ALERT);
    renderDashboard("SUPERVISOR", services(), { alerts: { process } as unknown as AlertService });

    fireEvent.click(await screen.findByRole("button", { name: /Marquer l'alerte R1/ }));

    await waitFor(() => expect(process).toHaveBeenCalledWith("01A"));
    expect(await screen.findByText("Alerte R1 de 3c6444 traitée.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir les 4 alertes actives" })).toHaveAttribute("href", "/alerts");
  });

  it("explains a refused processing", async () => {
    const process = vi.fn().mockRejectedValue(new ApiError(409));
    renderDashboard("SUPERVISOR", services(), { alerts: { process } as unknown as AlertService });

    fireEvent.click(await screen.findByRole("button", { name: /Marquer l'alerte R1/ }));

    expect(await screen.findByText("Cette alerte a déjà été traitée.")).toBeInTheDocument();
  });

  it.each([
    ["Mettre en pause", "pause", "Collecte mise en pause."],
    ["Lancer maintenant", "runNow", "Collecte lancée."],
  ])("lets a Supervisor use %s", async (button, method, message) => {
    const action = vi.fn().mockResolvedValue(undefined);
    const collection = { pause: action, resume: action, runNow: action } as unknown as CollectionService;
    renderDashboard("SUPERVISOR", services(), { collection });

    fireEvent.click(await screen.findByRole("button", { name: button }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(action).toHaveBeenCalledTimes(1);
    expect(method).toBeTruthy();
  });

  it("resumes a paused collection", async () => {
    const paused = new DashboardData(0, 0, 0, [], new CollectionSummary(true, true, false, null, null, []));
    const resume = vi.fn().mockResolvedValue(undefined);
    const collection = { resume } as unknown as CollectionService;
    renderDashboard("SUPERVISOR", services({ load: vi.fn().mockResolvedValue(paused) }), { collection });

    fireEvent.click(await screen.findByRole("button", { name: "Reprendre" }));

    await waitFor(() => expect(resume).toHaveBeenCalled());
  });

  it("explains a refused action of the collection", async () => {
    const runNow = vi.fn().mockRejectedValue(new ApiError(409));
    renderDashboard("SUPERVISOR", services(), { collection: { runNow } as unknown as CollectionService });

    fireEvent.click(await screen.findByRole("button", { name: "Lancer maintenant" }));

    await waitFor(() => expect(runNow).toHaveBeenCalled());
    expect(await screen.findByText(/désactivée, déjà en cours/)).toBeInTheDocument();
  });

  it("asks the chart again when the period changes", async () => {
    const service = renderDashboard("USER");
    await screen.findByRole("region", { name: "Alertes par règle" });

    fireEvent.click(screen.getByRole("button", { name: "7 jours" }));

    await waitFor(() => expect(service.statistics).toHaveBeenCalledWith("7d"));
  });

  it("warns when a part cannot be loaded, and still shows the others", async () => {
    renderDashboard("USER", services({ statistics: vi.fn().mockRejectedValue(new ApiError(500)) }));

    expect(await screen.findByText(/n'ont pas pu être chargées/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Alertes actives" })).toBeInTheDocument();
  });

  it("says nothing is shown while the first answer is awaited, and warns when it never comes", async () => {
    renderDashboard("USER", services({ load: vi.fn().mockRejectedValue(new ApiError(500)) }));

    expect(await screen.findByText(/n'ont pas pu être chargées/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Alertes actives" })).not.toBeInTheDocument();
  });

  it("follows an aircraft named in the search box, with its flight and its alert", async () => {
    const service = renderDashboard("USER");
    const search = await screen.findByRole("combobox", { name: "Suivre un aéronef" });

    fireEvent.change(search, { target: { value: "f-gkxa" } });
    fireEvent.submit(search);

    const card = await screen.findByRole("region", { name: "Aéronef suivi" });
    expect(card).toHaveTextContent("F-GKXA");
    expect(card).toHaveTextContent("R1");
    expect(card.querySelector("svg[role='img']")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Ouvrir la fiche" })).toHaveAttribute("href", "/aircraft/01AIRCRAFT");
    expect(service.flightOf).toHaveBeenCalledWith("01AIRCRAFT");
  });

  it("stops following when the card is closed", async () => {
    renderDashboard("USER");
    const search = await screen.findByRole("combobox", { name: "Suivre un aéronef" });
    fireEvent.change(search, { target: { value: "F-GKXA" } });
    fireEvent.submit(search);
    await screen.findByRole("region", { name: "Aéronef suivi" });

    fireEvent.click(screen.getByRole("button", { name: "Ne plus suivre" }));

    expect(screen.queryByRole("region", { name: "Aéronef suivi" })).not.toBeInTheDocument();
  });

  it("toggles the follow of the aircraft from its card", async () => {
    renderDashboard("USER");
    const search = await screen.findByRole("combobox", { name: "Suivre un aéronef" });
    fireEvent.change(search, { target: { value: "F-GKXA" } });
    fireEvent.submit(search);
    const follow = await screen.findByRole("button", { name: "Suivi" });

    fireEvent.click(follow);

    expect(screen.getByRole("button", { name: "Suivre" })).toHaveAttribute("aria-pressed", "false");
  });

  it("still follows an aircraft when its flight cannot be read", async () => {
    renderDashboard("USER", services({ flightOf: vi.fn().mockRejectedValue(new ApiError(500)) }));
    const search = await screen.findByRole("combobox", { name: "Suivre un aéronef" });
    fireEvent.change(search, { target: { value: "3c6444" } });
    fireEvent.submit(search);

    expect(await screen.findByRole("region", { name: "Aéronef suivi" })).toBeInTheDocument();
  });

  it("folds and unfolds the alerts over the map", async () => {
    renderDashboard("USER");
    await screen.findByRole("region", { name: "Alertes actives" });

    fireEvent.click(screen.getByRole("button", { name: "Replier les alertes" }));
    expect(screen.queryByRole("region", { name: "Alertes actives" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Alertes actives (4)" }));
    expect(screen.getByRole("region", { name: "Alertes actives" })).toBeInTheDocument();
  });
  describe("when an alert of the map is clicked", () => {
    it("centres the map on its aircraft first, then opens the alert in the alerts for a Supervisor", async () => {
      renderWithLocation("SUPERVISOR");

      fireEvent.click(await screen.findByRole("button", { name: CENTRE }));

      const card = await screen.findByRole("region", { name: "Aéronef suivi" });
      expect(card).toHaveTextContent("F-GKXA");
      expect(screen.getByTestId("where")).toHaveTextContent(/^\/$/);
      const row = screen.getByRole("button", { name: OPEN }).closest("tr");
      expect(row).toHaveAttribute("aria-selected", "true");

      fireEvent.click(screen.getByRole("button", { name: OPEN }));

      expect(screen.getByTestId("where")).toHaveTextContent("/alerts?alert=01A");
    });

    it("only centres the map for a User, who has no alerts page", async () => {
      renderWithLocation("USER");

      fireEvent.click(await screen.findByRole("button", { name: CENTRE }));
      await screen.findByRole("region", { name: "Aéronef suivi" });
      fireEvent.click(screen.getByRole("button", { name: CENTRE }));

      expect(screen.getByTestId("where")).toHaveTextContent(/^\/$/);
      expect(screen.getByRole("region", { name: "Aéronef suivi" })).toBeInTheDocument();
    });

    it("centres again, instead of opening the alert, once the aircraft is no longer followed", async () => {
      renderWithLocation("SUPERVISOR");
      fireEvent.click(await screen.findByRole("button", { name: CENTRE }));
      await screen.findByRole("region", { name: "Aéronef suivi" });
      fireEvent.click(screen.getByRole("button", { name: "Ne plus suivre" }));

      fireEvent.click(screen.getByRole("button", { name: CENTRE }));

      expect(await screen.findByRole("region", { name: "Aéronef suivi" })).toBeInTheDocument();
      expect(screen.getByTestId("where")).toHaveTextContent(/^\/$/);
    });

    it("goes straight to the alerts when its aircraft is not on the map, for a Supervisor", async () => {
      renderWithLocation("SUPERVISOR", services({ trackedAircraft: vi.fn().mockResolvedValue([]) }));

      fireEvent.click(await screen.findByRole("button", { name: CENTRE }));

      expect(screen.getByTestId("where")).toHaveTextContent("/alerts?alert=01A");
      expect(screen.queryByRole("region", { name: "Aéronef suivi" })).not.toBeInTheDocument();
    });
  });
});

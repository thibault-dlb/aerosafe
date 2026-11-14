import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Alert } from "@/models/Alert";
import { renderWithPreferences } from "@/test/preferences";

import AlertTable from "./AlertTable";

const TRIGGERED = new Date("2026-11-07T10:00:00Z");

function alert(overrides: { processedAt?: Date | null; episodeEndedAt?: Date | null; id?: string } = {}) {
  return new Alert(
    overrides.id ?? "01JC0000000000000000000A01",
    "R3",
    TRIGGERED,
    "R3 vertical rate for 3c6444",
    "01JC0000000000000000000001",
    "3c6444",
    "D-AIBD",
    "Variation importante d'altitude",
    40,
    30,
    "m/s",
    "HIGH",
    overrides.episodeEndedAt ?? null,
    overrides.processedAt ?? null,
  );
}

describe("AlertTable", () => {
  it("shows one row per alert", () => {
    renderWithPreferences(<AlertTable alerts={[new Alert("1", "R1", TRIGGERED, "Silent"), alert()]} />);

    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the criticality as a shape, the aircraft, the value against the threshold and the situation", () => {
    renderWithPreferences(<AlertTable alerts={[alert()]} caption="1 alerte" />);

    expect(screen.getByText("1 alerte")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Criticité Haute" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "D-AIBD" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "40 m/s / 30 m/s" })).toBeInTheDocument();
    expect(screen.getByText("En cours")).toBeInTheDocument();
    expect(screen.getByText("Non traitée")).toBeInTheDocument();
  });

  it("shows an alert without a criticality or an aircraft name", () => {
    renderWithPreferences(<AlertTable alerts={[new Alert("1", "R9", TRIGGERED, "x")]} />);

    expect(screen.getByRole("img", { name: "Criticité Aucune" })).toBeInTheDocument();
    expect(screen.getAllByRole("cell", { name: "–" }).length).toBeGreaterThan(0);
  });

  it("shows the value of R3 in feet per minute with the aeronautical units", () => {
    renderWithPreferences(<AlertTable alerts={[alert()]} />, { preferences: { "aerosafe.units": "aeronautical" } });

    expect(screen.getByRole("cell", { name: "7874 ft/min / 5905.5 ft/min" })).toBeInTheDocument();
  });

  it("says whether the situation lasts or ended", () => {
    renderWithPreferences(<AlertTable alerts={[alert({ episodeEndedAt: TRIGGERED })]} />);

    expect(screen.getByText("Terminée")).toBeInTheDocument();
  });

  it("offers the details and the processing of an alert", () => {
    const onSelect = vi.fn();
    const onProcess = vi.fn();
    const shown = alert();
    renderWithPreferences(<AlertTable alerts={[shown]} onSelect={onSelect} onProcess={onProcess} />);

    fireEvent.click(screen.getByRole("button", { name: "Détails de R3 pour D-AIBD" }));
    fireEvent.click(screen.getByRole("button", { name: "Marquer l'alerte R3 de D-AIBD comme traitée" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(shown);
    expect(onProcess).toHaveBeenCalledWith(shown);
  });

  it("opens the details with a click anywhere on the row", () => {
    const onSelect = vi.fn();
    renderWithPreferences(<AlertTable alerts={[alert()]} onSelect={onSelect} />);

    fireEvent.click(screen.getAllByRole("row")[1]);

    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("highlights the row whose details are open", () => {
    renderWithPreferences(
      <AlertTable alerts={[alert({ id: "A" }), alert({ id: "B" })]} onSelect={vi.fn()} selectedId="B" />,
    );

    const [, first, second] = screen.getAllByRole("row");
    expect(first).toHaveAttribute("aria-selected", "false");
    expect(second).toHaveAttribute("aria-selected", "true");
  });

  it("disables the button of the alert being processed", () => {
    renderWithPreferences(<AlertTable alerts={[alert()]} onProcess={vi.fn()} processingId={alert().id} />);

    expect(screen.getByRole("button", { name: /comme traitée/ })).toBeDisabled();
  });

  it("does not offer to process an alert twice", () => {
    renderWithPreferences(<AlertTable alerts={[alert({ processedAt: TRIGGERED })]} onProcess={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /comme traitée/ })).not.toBeInTheDocument();
    expect(screen.getByText("Traitée")).toBeInTheDocument();
  });

  describe("sorting", () => {
    it("has plain headers without a way to sort", () => {
      renderWithPreferences(<AlertTable alerts={[alert()]} />);

      expect(screen.queryByRole("button", { name: /Trier par/ })).not.toBeInTheDocument();
    });

    it("sorts by the column asked for, and says which one is sorted and how", () => {
      const onSort = vi.fn();
      renderWithPreferences(
        <AlertTable alerts={[alert()]} sorting={{ key: "triggered_at", order: "desc" }} onSort={onSort} />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Trier par Règle" }));
      fireEvent.click(screen.getByRole("button", { name: "Trier par Criticité" }));

      expect(onSort.mock.calls).toEqual([["rule"], ["criticality"]]);
      const sorted = screen.getByRole("columnheader", { name: /Déclenchée/ });
      expect(sorted).toHaveAttribute("aria-sort", "descending");
      expect(within(screen.getByRole("columnheader", { name: /Règle/ })).getByRole("button")).toBeInTheDocument();
    });

    it("says when the sort is ascending", () => {
      renderWithPreferences(
        <AlertTable alerts={[alert()]} sorting={{ key: "rule", order: "asc" }} onSort={vi.fn()} />,
      );

      expect(screen.getByRole("columnheader", { name: /Règle/ })).toHaveAttribute("aria-sort", "ascending");
    });
  });
});

describe("Alert.status", () => {
  it("describes where an alert stands", () => {
    expect(alert().status).toBe("active");
    expect(alert({ episodeEndedAt: TRIGGERED }).status).toBe("ended");
    expect(alert({ processedAt: TRIGGERED }).status).toBe("processed");
  });
});

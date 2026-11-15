import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Alert } from "@/models/Alert";
import { renderInApp } from "@/test/app";

import ActiveAlerts from "./ActiveAlerts";
import CounterRow from "./CounterRow";

const ALERT = new Alert("01A", "R1", new Date("2026-11-14T10:00:00Z"), "R1", "01B", "3c6444", null, "d", 1, 2, "s", "HIGH");

describe("ActiveAlerts", () => {
  it("says when nothing is active", () => {
    renderInApp(<ActiveAlerts alerts={[]} total={0} />);

    expect(screen.getByText("Aucune alerte active")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("lists the alerts and links to the alerts page for a Supervisor", () => {
    renderInApp(<ActiveAlerts alerts={[ALERT]} total={12} linkToAlerts />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir les 12 alertes actives" })).toHaveAttribute("href", "/alerts");
  });
});

describe("ActiveAlerts rows that can be clicked", () => {
  it("names what a click does, and highlights the row of the alert centred", () => {
    const { rerender } = renderInApp(<ActiveAlerts alerts={[ALERT]} total={1} onSelect={() => undefined} selectedId={null} />);
    expect(screen.getByRole("button", { name: "Centrer la carte sur 3c6444 (alerte R1)" })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /R1/ })).toHaveAttribute("aria-selected", "false");

    rerender(<ActiveAlerts alerts={[ALERT]} total={1} onSelect={() => undefined} selectedId="01A" linkToAlerts />);

    expect(screen.getByRole("button", { name: "Ouvrir l'alerte R1 de 3c6444 dans les alertes" })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /R1/ })).toHaveAttribute("aria-selected", "true");
  });

  it("calls back with the alert, from the button and from the row", () => {
    const onSelect = vi.fn();
    renderInApp(<ActiveAlerts alerts={[ALERT]} total={1} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: /Centrer la carte/ }));
    fireEvent.click(screen.getByText("3c6444"));

    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenCalledWith(ALERT);
  });

  it("leaves the rows alone without a callback", () => {
    renderInApp(<ActiveAlerts alerts={[ALERT]} total={1} />);

    expect(screen.queryByRole("button", { name: /Centrer la carte/ })).not.toBeInTheDocument();
  });
});

describe("CounterRow", () => {
  it("shows the four figures, and a dash while the aircraft are not loaded", () => {
    renderInApp(<CounterRow aircraft={null} active={4} unprocessed={9} last24h={17} />);

    expect(screen.getByText("–")).toBeInTheDocument();
    expect(screen.getByText("17")).toBeInTheDocument();
  });
});

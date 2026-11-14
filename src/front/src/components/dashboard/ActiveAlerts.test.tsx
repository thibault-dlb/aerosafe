import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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

describe("CounterRow", () => {
  it("shows the four figures, and a dash while the aircraft are not loaded", () => {
    renderInApp(<CounterRow aircraft={null} active={4} unprocessed={9} last24h={17} />);

    expect(screen.getByText("–")).toBeInTheDocument();
    expect(screen.getByText("17")).toBeInTheDocument();
  });
});

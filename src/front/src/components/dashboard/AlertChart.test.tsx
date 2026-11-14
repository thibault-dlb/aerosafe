import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DashboardStatistics, StatisticsSlice } from "@/models/Dashboard";
import { renderInApp } from "@/test/app";

import AlertChart from "./AlertChart";
import { ruleClass } from "./ruleClass";

const SLICES = [
  new StatisticsSlice(new Date("2026-11-14T08:00:00Z"), 0, {}),
  new StatisticsSlice(new Date("2026-11-14T09:00:00Z"), 5, { R1: 2, R3: 3 }),
  new StatisticsSlice(new Date("2026-11-14T10:00:00Z"), 1, { R7: 1 }),
];

describe("AlertChart", () => {
  it("draws one bar per rule and per slice, stacked", () => {
    renderInApp(<AlertChart statistics={new DashboardStatistics("24h", "hour", 6, SLICES)} period="24h" onPeriod={vi.fn()} />);

    const chart = screen.getByRole("img", { name: "Alertes par règle sur la période : 6 au total" });
    expect(chart.querySelectorAll("rect")).toHaveLength(3);
    expect(screen.getByRole("list")).toHaveTextContent("R1R3R7");
  });

  it("gives the data as a table too", () => {
    renderInApp(<AlertChart statistics={new DashboardStatistics("24h", "hour", 6, SLICES)} period="24h" onPeriod={vi.fn()} />);

    const table = screen.getByRole("table", { hidden: true });
    expect(within(table).getAllByRole("row", { hidden: true })).toHaveLength(4);
    expect(within(table).getByRole("columnheader", { name: "Total", hidden: true })).toBeInTheDocument();
  });

  it("labels the days when the period is cut per day", () => {
    renderInApp(<AlertChart statistics={new DashboardStatistics("7d", "day", 1, [new StatisticsSlice(new Date("2026-11-14T00:00:00Z"), 1, { R1: 1 })])} period="7d" onPeriod={vi.fn()} />);

    expect(screen.getAllByText("14/11").length).toBeGreaterThan(0);
  });

  it("says so when the period has no alert", () => {
    renderInApp(<AlertChart statistics={new DashboardStatistics("24h", "hour", 0, SLICES.slice(0, 1))} period="24h" onPeriod={vi.fn()} />);

    expect(screen.getByText("Aucune alerte sur la période.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("draws an empty chart until the first answer", () => {
    renderInApp(<AlertChart statistics={null} period="24h" onPeriod={vi.fn()} />);

    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("changes the period", () => {
    const onPeriod = vi.fn();
    renderInApp(<AlertChart statistics={null} period="24h" onPeriod={onPeriod} />);

    expect(screen.getByRole("button", { name: "24 h" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "30 jours" }));

    expect(onPeriod).toHaveBeenCalledWith("30d");
  });

  it("colours R1 to R5 and keeps a neutral colour for the next rules", () => {
    expect(ruleClass("R1")).not.toBe(ruleClass("R2"));
    expect(ruleClass("R6")).toBe(ruleClass("R12"));
    expect(ruleClass("R6")).not.toBe(ruleClass("R5"));
  });
});

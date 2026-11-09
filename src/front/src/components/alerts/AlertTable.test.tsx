import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Alert } from "@/models/Alert";

import AlertTable from "./AlertTable";

const TRIGGERED = new Date("2026-11-07T10:00:00Z");

function alert(overrides: { processedAt?: Date | null; episodeEndedAt?: Date | null } = {}) {
  return new Alert(
    "01JC0000000000000000000A01",
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
    render(<AlertTable alerts={[new Alert("1", "R1", TRIGGERED, "Silent")]} />);

    expect(screen.getByRole("cell", { name: "R1" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Silent" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the value, threshold, criticality and status", () => {
    render(<AlertTable alerts={[alert()]} caption="1 alert" />);

    expect(screen.getByText("1 alert")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "D-AIBD" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "40 m/s" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "30 m/s" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "HIGH" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Active" })).toBeInTheDocument();
  });

  it("offers the details and the processing of an alert", () => {
    const onSelect = vi.fn();
    const onProcess = vi.fn();
    const shown = alert();
    render(<AlertTable alerts={[shown]} onSelect={onSelect} onProcess={onProcess} />);

    fireEvent.click(screen.getByRole("button", { name: "Details of R3 for D-AIBD" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark R3 for D-AIBD as processed" }));

    expect(onSelect).toHaveBeenCalledWith(shown);
    expect(onProcess).toHaveBeenCalledWith(shown);
  });

  it("disables the button of the alert being processed", () => {
    render(<AlertTable alerts={[alert()]} onProcess={vi.fn()} processingId={alert().id} />);

    expect(screen.getByRole("button", { name: /as processed/ })).toBeDisabled();
  });

  it("does not offer to process an alert twice", () => {
    render(<AlertTable alerts={[alert({ processedAt: TRIGGERED })]} onProcess={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /as processed/ })).not.toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Processed" })).toBeInTheDocument();
  });
});

describe("Alert.statusLabel", () => {
  it("describes the status of an alert", () => {
    expect(alert().statusLabel).toBe("Active");
    expect(alert({ episodeEndedAt: TRIGGERED }).statusLabel).toBe("Ended, not processed");
    expect(alert({ processedAt: TRIGGERED }).statusLabel).toBe("Processed");
  });
});

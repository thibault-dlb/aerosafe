import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Rule, type RuleChanges } from "@/models/Rule";
import { ApiError } from "@/services/ApiClient";
import type { RuleService } from "@/services/RuleService";

import Rules from "./Rules";

const R1 = new Rule(
  "R1",
  "Délai trop long depuis le dernier contact",
  300,
  "s",
  "MEDIUM",
  true,
  new Date("2026-11-09T10:00:00Z"),
);

function renderWith(
  list: RuleService["list"] = async () => [R1],
  update: RuleService["update"] = async (code: string, changes: RuleChanges) =>
    new Rule(
      code,
      R1.description,
      changes.threshold ?? R1.threshold,
      R1.unit,
      changes.criticality === undefined ? R1.criticality : changes.criticality,
      changes.is_active ?? R1.isActive,
      new Date("2026-11-09T11:00:00Z"),
    ),
) {
  const service = { list: vi.fn(list), update: vi.fn(update) } as unknown as RuleService;
  render(<Rules service={service} />);
  return service.update as ReturnType<typeof vi.fn>;
}

describe("Rules", () => {
  it("shows its title", () => {
    renderWith();

    expect(screen.getByRole("heading", { name: "Rules" })).toBeInTheDocument();
  });

  it("lists the rules with their settings", async () => {
    renderWith();

    expect(await screen.findByLabelText("Threshold of R1 (s)")).toHaveValue(300);
    expect(screen.getByLabelText("Criticality of R1")).toHaveValue("MEDIUM");
    expect(screen.getByLabelText("R1 evaluated")).toBeChecked();
    expect(screen.getByRole("button", { name: "Save R1" })).toBeDisabled();
  });

  it("saves only the changed settings", async () => {
    const update = renderWith();

    fireEvent.change(await screen.findByLabelText("Threshold of R1 (s)"), {
      target: { value: "420" },
    });
    fireEvent.change(screen.getByLabelText("Criticality of R1"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save R1" }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("R1", { threshold: 420, criticality: null }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("R1 saved");
    expect(screen.getByLabelText("Threshold of R1 (s)")).toHaveValue(420);
  });

  it("can deactivate a rule", async () => {
    const update = renderWith();

    fireEvent.click(await screen.findByLabelText("R1 evaluated"));
    fireEvent.click(screen.getByRole("button", { name: "Save R1" }));

    await waitFor(() => expect(update).toHaveBeenCalledWith("R1", { is_active: false }));
  });

  it("refuses a negative or empty threshold", async () => {
    renderWith();
    const input = await screen.findByLabelText("Threshold of R1 (s)");

    fireEvent.change(input, { target: { value: "-1" } });
    expect(screen.getByRole("button", { name: "Save R1" })).toBeDisabled();
    expect(input).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Save R1" })).toBeDisabled();
  });

  it("explains a failed save", async () => {
    renderWith(undefined, async () => {
      throw new ApiError(403);
    });

    fireEvent.change(await screen.findByLabelText("Threshold of R1 (s)"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save R1" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Only Supervisors");
  });

  it("explains a failed loading", async () => {
    renderWith(async () => {
      throw new ApiError(401);
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Log in");
  });
});

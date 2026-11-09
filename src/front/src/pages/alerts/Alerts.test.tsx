import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { Alert, AlertPage } from "@/models/Alert";
import { ApiError } from "@/services/ApiClient";
import type { AlertService } from "@/services/AlertService";

import Alerts from "./Alerts";
import { errorMessage } from "./errorMessage";
import { DEFAULT_CRITERIA, PAGE_SIZE, periodReversed, toFilters } from "./filters";

const TRIGGERED = new Date("2026-11-09T10:00:00Z");

function alert(id: string, processedAt: Date | null = null): Alert {
  return new Alert(
    id,
    "R1",
    TRIGGERED,
    `R1 delay since the last contact for ${id}`,
    "01JC0000000000000000000001",
    "3c6444",
    null,
    "Délai trop long depuis le dernier contact",
    420,
    300,
    "s",
    "MEDIUM",
    null,
    processedAt,
  );
}

function renderWith(
  search: AlertService["search"],
  process: AlertService["process"] = async (id) => alert(id, TRIGGERED),
) {
  const service = {
    search: vi.fn(search),
    process: vi.fn(process),
  } as unknown as AlertService;
  render(
    <MemoryRouter>
      <Alerts service={service} />
    </MemoryRouter>,
  );
  return {
    search: service.search as ReturnType<typeof vi.fn>,
    process: service.process as ReturnType<typeof vi.fn>,
  };
}

describe("filters", () => {
  it("leaves empty criteria out and pages the results", () => {
    expect(toFilters(DEFAULT_CRITERIA, 50)).toEqual({
      rule: undefined,
      status: "unprocessed",
      criticality: undefined,
      icao24: undefined,
      start: undefined,
      end: undefined,
      sort: "triggered_at",
      order: "desc",
      limit: PAGE_SIZE,
      offset: 50,
    });
  });

  it("reads the dates of the period", () => {
    const criteria = { ...DEFAULT_CRITERIA, start: "2026-11-09T10:00", end: "2026-11-09T09:00" };

    expect(toFilters(criteria, 0).start).toEqual(new Date("2026-11-09T10:00"));
    expect(periodReversed(criteria)).toBe(true);
    expect(periodReversed(DEFAULT_CRITERIA)).toBe(false);
  });
});

describe("errorMessage", () => {
  it("explains each API failure", () => {
    expect(errorMessage(new ApiError(401))).toMatch(/Log in/);
    expect(errorMessage(new ApiError(403))).toMatch(/Only Supervisors/);
    expect(errorMessage(new ApiError(404))).toMatch(/no longer exists/);
    expect(errorMessage(new ApiError(409))).toMatch(/already processed/);
    expect(errorMessage(new ApiError(422))).toMatch(/Check/);
    expect(errorMessage(new Error("network"))).toMatch(/could not be reached/);
  });
});

describe("Alerts", () => {
  it("shows its title", () => {
    renderWith(async () => new AlertPage([], 0));

    expect(screen.getByRole("heading", { name: "Alerts" })).toBeInTheDocument();
  });

  it("lists the alerts left to process by default", async () => {
    const { search } = renderWith(async () => new AlertPage([alert("A1")], 1));

    expect(await screen.findByText("Alerts 1 to 1 of 1")).toBeInTheDocument();
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ status: "unprocessed", offset: 0 }));
  });

  it("says when no alert matches", async () => {
    renderWith(async () => new AlertPage([], 0));

    expect(await screen.findByText("No alert matches these criteria.")).toBeInTheDocument();
  });

  it("applies the filters", async () => {
    const { search } = renderWith(async () => new AlertPage([], 0));
    await screen.findByText("No alert matches these criteria.");

    fireEvent.change(screen.getByLabelText("Rule"), { target: { value: "R3" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Criticality"), { target: { value: "HIGH" } });
    fireEvent.change(screen.getByLabelText("ICAO24 address"), { target: { value: "3c6" } });
    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "criticality" } });
    fireEvent.change(screen.getByLabelText("Order"), { target: { value: "asc" } });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-11-09T08:00" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-11-09T12:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(search).toHaveBeenLastCalledWith(
        expect.objectContaining({
          rule: "R3",
          status: undefined,
          criticality: "HIGH",
          icao24: "3c6",
          sort: "criticality",
          order: "asc",
          start: new Date("2026-11-09T08:00"),
        }),
      ),
    );
  });

  it("refuses a reversed period", async () => {
    const { search } = renderWith(async () => new AlertPage([], 0));
    await screen.findByText("No alert matches these criteria.");

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-11-09T12:00" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-11-09T08:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("must not be after its end");
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("pages through the alerts", async () => {
    const { search } = renderWith(async (filters) =>
      new AlertPage([alert(`A${filters?.offset ?? 0}`)], PAGE_SIZE + 1),
    );
    expect(await screen.findByText(`Alerts 1 to ${PAGE_SIZE} of ${PAGE_SIZE + 1}`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(
      await screen.findByText(`Alerts ${PAGE_SIZE + 1} to ${PAGE_SIZE + 1} of ${PAGE_SIZE + 1}`),
    ).toBeInTheDocument();
    expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ offset: PAGE_SIZE }));
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    await waitFor(() =>
      expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 0 })),
    );
  });

  it("ignores the answer of a search replaced by a newer one", async () => {
    let answerFirstPage: (page: AlertPage) => void = () => undefined;
    const { search } = renderWith((filters) =>
      filters?.rule === "R3"
        ? Promise.resolve(new AlertPage([alert("R3-alert")], 1))
        : new Promise((resolve) => {
            answerFirstPage = resolve;
          }),
    );

    fireEvent.change(screen.getByLabelText("Rule"), { target: { value: "R3" } });
    // Submitted while the first search runs (the Apply button is then disabled).
    fireEvent.submit(screen.getByRole("form", { name: "Alert filters" }));
    await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Alerts 1 to 1 of 1")).toBeInTheDocument();

    answerFirstPage(new AlertPage([alert("A1"), alert("A2")], 2));

    await waitFor(() => expect(screen.getByText("Alerts 1 to 1 of 1")).toBeInTheDocument());
    expect(screen.queryByText("Alerts 1 to 2 of 2")).not.toBeInTheDocument();
  });

  it("opens the details of an alert", async () => {
    renderWith(async () => new AlertPage([alert("A1")], 1));

    fireEvent.click(await screen.findByRole("button", { name: "Details of R1 for 3c6444" }));

    const details = screen.getByRole("region", { name: "Alert details" });
    expect(details).toHaveTextContent("R1: Délai trop long depuis le dernier contact");
    expect(details).toHaveTextContent("420 s");
    expect(details).toHaveTextContent("300 s");
    expect(details).toHaveTextContent("Still active");
    expect(screen.getByRole("link", { name: "Adjust the threshold of R1" })).toHaveAttribute(
      "href",
      "/rules",
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("region", { name: "Alert details" })).not.toBeInTheDocument();
  });

  it("marks an alert as processed and reloads the list", async () => {
    const { search, process } = renderWith(async () => new AlertPage([alert("A1")], 1));

    fireEvent.click(await screen.findByRole("button", { name: "Details of R1 for 3c6444" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark R1 for 3c6444 as processed" }));

    await waitFor(() => expect(process).toHaveBeenCalledWith("A1"));
    await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("region", { name: "Alert details" })).toHaveTextContent("Processed on");
  });

  it("explains a failed processing", async () => {
    renderWith(
      async () => new AlertPage([alert("A1")], 1),
      async () => {
        throw new ApiError(409);
      },
    );

    fireEvent.click(await screen.findByRole("button", { name: "Mark R1 for 3c6444 as processed" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("already processed");
  });

  it("explains a failed loading", async () => {
    renderWith(async () => {
      throw new ApiError(403);
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Only Supervisors");
  });
});

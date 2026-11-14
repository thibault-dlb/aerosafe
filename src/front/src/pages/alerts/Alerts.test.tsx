import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Alert, AlertPage } from "@/models/Alert";
import { Rule } from "@/models/Rule";
import { ApiError } from "@/services/ApiClient";
import type { AlertService } from "@/services/AlertService";
import type { RuleService } from "@/services/RuleService";
import { renderInApp } from "@/test/app";

import Alerts from "./Alerts";
import { AlertCriteria } from "./AlertCriteria";

const { PAGE_SIZE } = AlertCriteria;

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

const RULES = ["R1", "R3", "R6"].map((code) => new Rule(code, code, 1, "s", null, true, TRIGGERED));

function renderWith(
  search: AlertService["search"],
  process: AlertService["process"] = async (id) => alert(id, TRIGGERED),
) {
  const service = {
    search: vi.fn(search),
    process: vi.fn(process),
  } as unknown as AlertService;
  const ruleService = { list: vi.fn(async () => RULES) } as unknown as RuleService;
  renderInApp(<Alerts service={service} ruleService={ruleService} />);
  return {
    search: service.search as ReturnType<typeof vi.fn>,
    process: service.process as ReturnType<typeof vi.fn>,
  };
}

const DETAILS = "Détails de R1 pour 3c6444";
const PROCESS = "Marquer l'alerte R1 de 3c6444 comme traitée";

function openMoreFilters() {
  fireEvent.click(screen.getByRole("button", { name: "Plus de filtres" }));
}

describe("filters", () => {
  it("leaves empty criteria out and pages the results", () => {
    expect(AlertCriteria.toFilters(AlertCriteria.DEFAULT, 50)).toEqual({
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
    const criteria = { ...AlertCriteria.DEFAULT, start: "2026-11-09T10:00", end: "2026-11-09T09:00" };

    expect(AlertCriteria.toFilters(criteria, 0).start).toEqual(new Date("2026-11-09T10:00"));
    expect(AlertCriteria.periodReversed(criteria)).toBe(true);
    expect(AlertCriteria.periodReversed(AlertCriteria.DEFAULT)).toBe(false);
  });
});

describe("Alerts", () => {
  it("shows its title", () => {
    renderWith(async () => new AlertPage([], 0));

    expect(screen.getByRole("heading", { level: 1, name: "Alertes" })).toBeInTheDocument();
  });

  it("lists the alerts left to process by default, and counts them", async () => {
    const { search } = renderWith(async () => new AlertPage([alert("A1")], 1));

    expect(await screen.findByText("1 alerte")).toBeInTheDocument();
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ status: "unprocessed", offset: 0 }));
    expect(screen.getByRole("button", { name: "Non traitées" })).toHaveAttribute("aria-pressed", "true");
  });

  it("says the sky is clear when no alert matches", async () => {
    renderWith(async () => new AlertPage([], 0));

    expect(await screen.findByText("Ciel calme")).toBeInTheDocument();
    expect(screen.getByText("Aucune alerte ne correspond à ces filtres.")).toBeInTheDocument();
    expect(screen.getByText("0 alerte", { exact: false })).toBeInTheDocument();
  });

  it("offers the rules read from the API", async () => {
    renderWith(async () => new AlertPage([], 0));
    openMoreFilters();

    expect(await screen.findByRole("option", { name: "R6" })).toBeInTheDocument();
    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["Toutes les règles", "R1", "R3", "R6"]);
  });

  it("applies a status and a criticality at once, and a second click on a criticality removes it", async () => {
    const { search } = renderWith(async () => new AlertPage([], 0));
    await screen.findByText("Ciel calme");

    fireEvent.click(screen.getByRole("button", { name: "En cours" }));
    await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ status: "active" })));

    fireEvent.click(screen.getByRole("button", { name: "Toutes" }));
    await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ status: undefined })));

    fireEvent.click(screen.getByRole("button", { name: "Haute" }));
    await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ criticality: "HIGH" })));
    expect(screen.getByRole("button", { name: "Haute" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Haute" }));
    await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ criticality: undefined })));
  });

  it("applies the rule, the address and the period of the other filters", async () => {
    const { search } = renderWith(async () => new AlertPage([], 0));
    await screen.findByText("Ciel calme");
    await screen.findByText("Ciel calme");
    openMoreFilters();
    await screen.findByRole("option", { name: "R3" });

    fireEvent.change(screen.getByLabelText("Règle"), { target: { value: "R3" } });
    fireEvent.change(screen.getByLabelText("Adresse ICAO24"), { target: { value: "3c6" } });
    fireEvent.change(screen.getByLabelText("Du"), { target: { value: "2026-11-09T08:00" } });
    fireEvent.change(screen.getByLabelText("Au"), { target: { value: "2026-11-09T12:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Appliquer" }));

    await waitFor(() =>
      expect(search).toHaveBeenLastCalledWith(
        expect.objectContaining({
          rule: "R3",
          icao24: "3c6",
          start: new Date("2026-11-09T08:00"),
          end: new Date("2026-11-09T12:00"),
        }),
      ),
    );
  });

  it("clears every filter", async () => {
    const { search } = renderWith(async () => new AlertPage([], 0));
    await screen.findByText("Ciel calme");
    fireEvent.click(screen.getByRole("button", { name: "Toutes" }));
    fireEvent.click(screen.getByRole("button", { name: "Haute" }));
    await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ criticality: "HIGH" })));

    fireEvent.click(screen.getAllByRole("button", { name: "Effacer les filtres" })[0]);

    await waitFor(() =>
      expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ status: "unprocessed", criticality: undefined })),
    );
  });

  it("refuses a reversed period", async () => {
    const { search } = renderWith(async () => new AlertPage([], 0));
    await screen.findByText("Ciel calme");
    openMoreFilters();

    fireEvent.change(screen.getByLabelText("Du"), { target: { value: "2026-11-09T12:00" } });
    fireEvent.change(screen.getByLabelText("Au"), { target: { value: "2026-11-09T08:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Appliquer" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("ne peut pas suivre sa fin");
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("sorts by a column, then reverses the sort on a second click", async () => {
    const { search } = renderWith(async () => new AlertPage([alert("A1")], 1));
    await screen.findByText("1 alerte");

    fireEvent.click(screen.getByRole("button", { name: "Trier par Règle" }));
    await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "rule", order: "asc" })));

    fireEvent.click(screen.getByRole("button", { name: "Trier par Règle" }));
    await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "rule", order: "desc" })));

    fireEvent.click(screen.getByRole("button", { name: "Trier par Criticité" }));
    await waitFor(() =>
      expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "criticality", order: "desc" })),
    );
    expect(screen.getByRole("columnheader", { name: /Crit\./ })).toHaveAttribute("aria-sort", "descending");
  });

  it("pages through the alerts", async () => {
    const { search } = renderWith(async (filters) =>
      new AlertPage([alert(`A${filters?.offset ?? 0}`)], PAGE_SIZE + 1),
    );
    expect(await screen.findByText(`1 à ${PAGE_SIZE} sur ${PAGE_SIZE + 1}`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page précédente" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Page suivante" }));

    expect(await screen.findByText(`${PAGE_SIZE + 1} à ${PAGE_SIZE + 1} sur ${PAGE_SIZE + 1}`)).toBeInTheDocument();
    expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ offset: PAGE_SIZE }));
    expect(screen.getByRole("button", { name: "Page suivante" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Page précédente" }));
    await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 0 })));
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

    openMoreFilters();
    await screen.findByRole("option", { name: "R3" });
    fireEvent.change(screen.getByLabelText("Règle"), { target: { value: "R3" } });
    // Submitted while the first search runs (the Apply button is then disabled).
    fireEvent.submit(screen.getByRole("form", { name: "Plus de filtres" }));
    await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("1 alerte")).toBeInTheDocument();

    answerFirstPage(new AlertPage([alert("A1"), alert("A2")], 2));

    await waitFor(() => expect(screen.getByText("1 alerte")).toBeInTheDocument());
    expect(screen.queryByText("2 alertes")).not.toBeInTheDocument();
  });

  it("opens the details of an alert, and closes them", async () => {
    renderWith(async () => new AlertPage([alert("A1")], 1));

    fireEvent.click(await screen.findByRole("button", { name: DETAILS }));

    const details = screen.getByRole("region", { name: "Détail de l'alerte" });
    expect(details).toHaveTextContent("R1 · Contact perdu");
    expect(details).toHaveTextContent("420 s");
    expect(details).toHaveTextContent("seuil 300 s");
    expect(details).toHaveTextContent("Toujours en cours");
    expect(screen.getByRole("link", { name: "Pas pertinent ? Ajuster le seuil de R1" })).toHaveAttribute("href", "/rules");

    fireEvent.click(screen.getByRole("button", { name: "Fermer le détail" }));
    expect(screen.queryByRole("region", { name: "Détail de l'alerte" })).not.toBeInTheDocument();
  });

  it("closes the details when the filters change", async () => {
    renderWith(async () => new AlertPage([alert("A1")], 1));
    fireEvent.click(await screen.findByRole("button", { name: DETAILS }));

    fireEvent.click(screen.getByRole("button", { name: "Toutes" }));

    expect(screen.queryByRole("region", { name: "Détail de l'alerte" })).not.toBeInTheDocument();
  });

  it("marks an alert as processed, confirms it and reloads the list", async () => {
    const { search, process } = renderWith(async () => new AlertPage([alert("A1")], 1));

    fireEvent.click(await screen.findByRole("button", { name: DETAILS }));
    fireEvent.click(screen.getByRole("button", { name: "Marquer comme traitée" }));

    await waitFor(() => expect(process).toHaveBeenCalledWith("A1"));
    await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Alerte R1 de 3c6444 traitée.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Détail de l'alerte" })).toHaveTextContent("Traitée le");
  });

  it("keeps the range of the rows shown while the next page loads", async () => {
    let release: () => void = () => undefined;
    const nextPageLoaded = new Promise<void>((resolve) => {
      release = resolve;
    });
    renderWith(async (filters) => {
      const offset = filters?.offset ?? 0;
      if (offset > 0) await nextPageLoaded;
      const shown = offset === 0 ? PAGE_SIZE : 1;
      return new AlertPage(
        Array.from({ length: shown }, (_, index) => alert(`A${offset + index}`)),
        PAGE_SIZE + 1,
      );
    });
    await screen.findByText(`1 à ${PAGE_SIZE} sur ${PAGE_SIZE + 1}`);

    fireEvent.click(screen.getByRole("button", { name: "Page suivante" }));

    // The rows of the first page stay on screen until the second one arrives, so the
    // summary must keep describing them.
    expect(screen.getByText(`1 à ${PAGE_SIZE} sur ${PAGE_SIZE + 1}`)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: DETAILS })).toHaveLength(PAGE_SIZE);

    release();
    expect(await screen.findByText(`${PAGE_SIZE + 1} à ${PAGE_SIZE + 1} sur ${PAGE_SIZE + 1}`)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: DETAILS })).toHaveLength(1);
  });

  it("goes back a page when processing empties the current one", async () => {
    let unprocessed = PAGE_SIZE + 1;
    const { search } = renderWith(
      async (filters) => {
        const offset = filters?.offset ?? 0;
        const shown = Math.max(0, Math.min(PAGE_SIZE, unprocessed - offset));
        return new AlertPage(
          Array.from({ length: shown }, (_, index) => alert(`A${offset + index}`)),
          unprocessed,
        );
      },
      async (id) => {
        unprocessed -= 1;
        return alert(id, TRIGGERED);
      },
    );
    await screen.findByText(`1 à ${PAGE_SIZE} sur ${PAGE_SIZE + 1}`);
    fireEvent.click(screen.getByRole("button", { name: "Page suivante" }));
    await screen.findByText(`${PAGE_SIZE + 1} à ${PAGE_SIZE + 1} sur ${PAGE_SIZE + 1}`);

    fireEvent.click(screen.getByRole("button", { name: PROCESS }));

    expect(await screen.findByText(`1 à ${PAGE_SIZE} sur ${PAGE_SIZE}`)).toBeInTheDocument();
    expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 0 }));
    expect(screen.queryByText("Ciel calme")).not.toBeInTheDocument();
  });

  it("explains a failed processing in a notification", async () => {
    renderWith(
      async () => new AlertPage([alert("A1")], 1),
      async () => {
        throw new ApiError(409);
      },
    );

    fireEvent.click(await screen.findByRole("button", { name: PROCESS }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Cette alerte a déjà été traitée.");
  });

  it("explains a failed loading", async () => {
    renderWith(async () => {
      throw new ApiError(403);
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Seuls les Superviseurs");
  });

  it("says it is loading until the first answer", () => {
    renderWith(() => new Promise(() => undefined));

    expect(screen.getByText("Chargement des alertes…")).toBeInTheDocument();
  });
});

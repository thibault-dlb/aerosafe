import type { Criticality } from "@/models/Alert";
import type { AlertFilters, AlertSort, AlertStatus } from "@/services/AlertService";

export const PAGE_SIZE = 25;

/** Values of the alert filter form. Dates come from `datetime-local` inputs. */
export interface Criteria {
  rule: string;
  status: "" | AlertStatus;
  criticality: "" | Criticality;
  icao24: string;
  start: string;
  end: string;
  sort: AlertSort;
  order: "asc" | "desc";
}

/** By default the Supervisor sees what is left to process, the latest first. */
export const DEFAULT_CRITERIA: Criteria = {
  rule: "",
  status: "unprocessed",
  criticality: "",
  icao24: "",
  start: "",
  end: "",
  sort: "triggered_at",
  order: "desc",
};

/** Turns the form values into API filters for one page. */
export function toFilters(criteria: Criteria, offset: number): AlertFilters {
  return {
    rule: criteria.rule || undefined,
    status: criteria.status || undefined,
    criticality: criteria.criticality || undefined,
    icao24: criteria.icao24 || undefined,
    start: criteria.start ? new Date(criteria.start) : undefined,
    end: criteria.end ? new Date(criteria.end) : undefined,
    sort: criteria.sort,
    order: criteria.order,
    limit: PAGE_SIZE,
    offset,
  };
}

/** True when both dates are given and the start comes after the end. */
export function periodReversed(criteria: Criteria): boolean {
  return Boolean(
    criteria.start && criteria.end && new Date(criteria.start) > new Date(criteria.end),
  );
}

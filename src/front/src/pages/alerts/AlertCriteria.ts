import type { Criticality } from "@/models/Alert";
import type {
  AlertFilters,
  AlertSort,
  AlertStatus,
} from "@/services/AlertService";

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

/** The criteria of the alert filter form and their translation into API filters. */
export class AlertCriteria {
  static readonly PAGE_SIZE = 25;

  /** By default the Supervisor sees what is left to process, the latest first. */
  static readonly DEFAULT: Criteria = {
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
  static toFilters(criteria: Criteria, offset: number): AlertFilters {
    return {
      rule: criteria.rule || undefined,
      status: criteria.status || undefined,
      criticality: criteria.criticality || undefined,
      icao24: criteria.icao24 || undefined,
      start: criteria.start ? new Date(criteria.start) : undefined,
      end: criteria.end ? new Date(criteria.end) : undefined,
      sort: criteria.sort,
      order: criteria.order,
      limit: AlertCriteria.PAGE_SIZE,
      offset,
    };
  }

  /** True when both dates are given and the start comes after the end. */
  static periodReversed(criteria: Criteria): boolean {
    return Boolean(
      criteria.start &&
      criteria.end &&
      new Date(criteria.start) > new Date(criteria.end),
    );
  }
}

import {
  Alert,
  type AlertJson,
  AlertPage,
  type AlertPageJson,
  AlertStatistics,
  type AlertStatisticsJson,
  type Criticality,
} from "@/models/Alert";
import { ApiClient } from "@/services/ApiClient";

export type AlertStatus = "active" | "unprocessed" | "processed";
export type AlertSort = "triggered_at" | "criticality" | "rule";

/** Criteria of the alert list (BF-12). Empty criteria are left out of the request. */
export interface AlertFilters {
  rule?: string;
  status?: AlertStatus;
  criticality?: Criticality;
  icao24?: string;
  start?: Date;
  end?: Date;
  sort?: AlertSort;
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

/** Calls the alert endpoints of the API (BF-12, UC-04). */
export class AlertService {
  constructor(private readonly client: ApiClient = new ApiClient()) {}

  static query(filters: AlertFilters): string {
    const params = new URLSearchParams();
    for (const key of ["rule", "status", "criticality", "sort", "order"] as const) {
      const value = filters[key];
      if (value) params.set(key, value);
    }
    const icao24 = filters.icao24?.trim();
    if (icao24) params.set("icao24", icao24);
    if (filters.start) params.set("start", filters.start.toISOString());
    if (filters.end) params.set("end", filters.end.toISOString());
    if (filters.limit !== undefined) params.set("limit", String(filters.limit));
    if (filters.offset !== undefined) params.set("offset", String(filters.offset));
    const query = params.toString();
    return query ? `?${query}` : "";
  }

  async search(filters: AlertFilters = {}): Promise<AlertPage> {
    const json = await this.client.get<AlertPageJson>(`/v1/alerts${AlertService.query(filters)}`);
    return AlertPage.fromJson(json);
  }

  async get(alertId: string): Promise<Alert> {
    const json = await this.client.get<AlertJson>(`/v1/alerts/${encodeURIComponent(alertId)}`);
    return Alert.fromJson(json);
  }

  /** Marks the alert as processed by the current Supervisor. */
  async process(alertId: string): Promise<Alert> {
    const json = await this.client.post<AlertJson>(
      `/v1/alerts/${encodeURIComponent(alertId)}/process`,
    );
    return Alert.fromJson(json);
  }

  /** Alert counts per rule; the API defaults to the last 24 hours. */
  async statistics(start?: Date, end?: Date): Promise<AlertStatistics> {
    const params = new URLSearchParams();
    if (start) params.set("start", start.toISOString());
    if (end) params.set("end", end.toISOString());
    const query = params.toString() ? `?${params.toString()}` : "";
    const json = await this.client.get<AlertStatisticsJson>(`/v1/alerts/statistics${query}`);
    return AlertStatistics.fromJson(json);
  }
}

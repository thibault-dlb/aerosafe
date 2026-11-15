import { Alert, type AlertJson } from "@/models/Alert";

/** How far back the chart of alerts goes. */
export type StatisticsPeriod = "24h" | "7d" | "30d";

export interface CollectionSummaryJson {
  enabled: boolean;
  paused: boolean;
  running: boolean;
  last_success_at: string | null;
  remaining_credits: number | null;
  recent_runs: { started_at: string; status: string }[];
}

export interface DashboardJson {
  counters: { active_alerts: number; unprocessed_alerts: number; alerts_24h: number };
  active_alerts: AlertJson[];
  /** For each aircraft with an active alert, its most critical one. */
  alerted_aircraft?: AlertJson[];
  collection: CollectionSummaryJson;
}

export interface DashboardStatisticsJson {
  period: StatisticsPeriod;
  unit: "hour" | "day";
  start: string;
  end: string;
  total: number;
  slices: { start: string; total: number; per_rule: Record<string, number> }[];
}

/** One run of the collection, as the mini history shows it. */
export class CollectionRun {
  constructor(
    readonly startedAt: Date,
    readonly status: string,
  ) {}

  /** The run brought data in (all of it or part of it). */
  get collected(): boolean {
    return this.status === "SUCCESS" || this.status === "PARTIAL";
  }
}

/** State of the OpenSky collection, readable by every account. */
export class CollectionSummary {
  constructor(
    readonly enabled: boolean,
    readonly paused: boolean,
    readonly running: boolean,
    readonly lastSuccessAt: Date | null,
    readonly remainingCredits: number | null,
    readonly recentRuns: CollectionRun[],
  ) {}

  static fromJson(json: CollectionSummaryJson): CollectionSummary {
    return new CollectionSummary(
      json.enabled,
      json.paused,
      json.running,
      json.last_success_at ? new Date(json.last_success_at) : null,
      json.remaining_credits,
      json.recent_runs.map((run) => new CollectionRun(new Date(run.started_at), run.status)),
    );
  }
}

/** The figures at the top of the dashboard, the latest active alerts and the collection. */
export class Dashboard {
  constructor(
    readonly activeAlerts: number,
    readonly unprocessedAlerts: number,
    readonly alertsLast24h: number,
    readonly latestAlerts: Alert[],
    readonly collection: CollectionSummary,
    /** For each aircraft with an active alert, its most critical one: the map colours them. */
    readonly alertedAircraft: Alert[] = [],
  ) {}

  static fromJson(json: DashboardJson): Dashboard {
    return new Dashboard(
      json.counters.active_alerts,
      json.counters.unprocessed_alerts,
      json.counters.alerts_24h,
      json.active_alerts.map((alert) => Alert.fromJson(alert)),
      CollectionSummary.fromJson(json.collection),
      (json.alerted_aircraft ?? []).map((alert) => Alert.fromJson(alert)),
    );
  }
}

/** Alerts of one hour or one day, per rule code. */
export class StatisticsSlice {
  constructor(
    readonly start: Date,
    readonly total: number,
    readonly perRule: Record<string, number>,
  ) {}
}

/** The chart of alerts: every slice of the period, the empty ones included. */
export class DashboardStatistics {
  constructor(
    readonly period: StatisticsPeriod,
    readonly unit: "hour" | "day",
    readonly total: number,
    readonly slices: StatisticsSlice[],
  ) {}

  static fromJson(json: DashboardStatisticsJson): DashboardStatistics {
    return new DashboardStatistics(
      json.period,
      json.unit,
      json.total,
      json.slices.map((slice) => new StatisticsSlice(new Date(slice.start), slice.total, slice.per_rule)),
    );
  }

  /** The rule codes that appear in the period, in order (R1, R2, ...). */
  get ruleCodes(): string[] {
    return [...new Set(this.slices.flatMap((slice) => Object.keys(slice.perRule)))].sort();
  }

  /** The tallest bar: the scale of the chart. */
  get peak(): number {
    return this.slices.reduce((best, slice) => Math.max(best, slice.total), 0);
  }
}

import { Alert, type AlertJson } from "@/models/Alert";
import type { ZoneArea, ZoneCircle } from "@/services/Basemap";
import { type DataMode, DataModeService } from "@/services/DataModeService";

/** How far back the chart of alerts goes. */
export type StatisticsPeriod = "24h" | "7d" | "30d";

export interface CollectionAreaJson {
  south: number;
  west: number;
  north: number;
  east: number;
  /** The centre and the radius of a circle (adsb.fi); null for a box (OpenSky). */
  latitude?: number | null;
  longitude?: number | null;
  radius_km?: number | null;
}

export interface CollectionSummaryJson {
  source?: string;
  period_seconds?: number | null;
  area?: CollectionAreaJson | null;
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

/** The area of a collection: the rectangle the map frames, and the circle it draws for adsb.fi. */
export class CollectionArea {
  constructor(
    readonly bounds: ZoneArea,
    readonly circle: ZoneCircle | null,
  ) {}

  static fromJson(json: CollectionAreaJson): CollectionArea {
    const bounds = { south: json.south, west: json.west, north: json.north, east: json.east };
    const { latitude, longitude, radius_km: radiusKm } = json;
    const circle = latitude != null && longitude != null && radiusKm != null ? { latitude, longitude, radiusKm } : null;
    return new CollectionArea(bounds, circle);
  }

  /** What the map outlines: the circle when there is one, otherwise the rectangle. */
  get zone(): ZoneArea | ZoneCircle {
    return this.circle ?? this.bounds;
  }
}

/** State of the collection of one live source, readable by every account. */
export class CollectionSummary {
  constructor(
    readonly enabled: boolean,
    readonly paused: boolean,
    readonly running: boolean,
    readonly lastSuccessAt: Date | null,
    readonly remainingCredits: number | null,
    readonly recentRuns: CollectionRun[],
    readonly source: DataMode = "opensky",
    /** Seconds between two collections: the map refreshes at this pace. Null when unknown. */
    readonly periodSeconds: number | null = null,
    readonly area: CollectionArea | null = null,
  ) {}

  static fromJson(json: CollectionSummaryJson): CollectionSummary {
    const source = DataModeService.isMode(json.source ?? null) ? (json.source as DataMode) : "opensky";
    return new CollectionSummary(
      json.enabled,
      json.paused,
      json.running,
      json.last_success_at ? new Date(json.last_success_at) : null,
      json.remaining_credits,
      json.recent_runs.map((run) => new CollectionRun(new Date(run.started_at), run.status)),
      source,
      json.period_seconds ?? null,
      json.area ? CollectionArea.fromJson(json.area) : null,
    );
  }

  /** Only OpenSky counts credits. */
  get countsCredits(): boolean {
    return this.source === "opensky";
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

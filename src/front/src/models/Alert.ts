/** Criticality levels of `R_CRITICITE`. */
export type Criticality = "LOW" | "MEDIUM" | "HIGH";

/** JSON of an alert, as returned by `GET /v1/alerts` and `GET /v1/alerts/{id}`. */
export interface AlertJson {
  id: string;
  aircraft_id: string;
  icao24: string;
  registration: string | null;
  rule_code: string;
  rule_description: string;
  triggered_at: string;
  episode_ended_at: string | null;
  observed_value: number | null;
  threshold: number | null;
  unit: string;
  message: string;
  criticality: Criticality | null;
  processed_at: string | null;
}

/** JSON of one page of alerts. */
export interface AlertPageJson {
  items: AlertJson[];
  total: number;
}

/** JSON of the alert statistics of a period. */
export interface AlertStatisticsJson {
  start: string;
  end: string;
  total: number;
  per_rule: Record<string, number>;
}

/** An alert raised by the rules engine. `id` is the public ULID. */
export class Alert {
  constructor(
    readonly id: string,
    readonly ruleCode: string,
    readonly triggeredAt: Date,
    readonly message: string,
    readonly aircraftId: string = "",
    readonly icao24: string = "",
    readonly registration: string | null = null,
    readonly ruleDescription: string = "",
    readonly observedValue: number | null = null,
    readonly threshold: number | null = null,
    readonly unit: string = "",
    readonly criticality: Criticality | null = null,
    readonly episodeEndedAt: Date | null = null,
    readonly processedAt: Date | null = null,
  ) {}

  static fromJson(json: AlertJson): Alert {
    return new Alert(
      json.id,
      json.rule_code,
      new Date(json.triggered_at),
      json.message,
      json.aircraft_id,
      json.icao24,
      json.registration,
      json.rule_description,
      json.observed_value,
      json.threshold,
      json.unit,
      json.criticality,
      json.episode_ended_at ? new Date(json.episode_ended_at) : null,
      json.processed_at ? new Date(json.processed_at) : null,
    );
  }

  /** The situation still lasts. */
  get active(): boolean {
    return this.episodeEndedAt === null;
  }

  /** Where the alert stands for the Supervisor. */
  get statusLabel(): string {
    if (this.processed) return "Processed";
    return this.active ? "Active" : "Ended, not processed";
  }

  get processed(): boolean {
    return this.processedAt !== null;
  }

  /** The registration when known, otherwise the ICAO24 address. */
  get aircraftName(): string {
    return this.registration ?? this.icao24;
  }
}

/** One page of alerts and the number of alerts matching the filters. */
export class AlertPage {
  constructor(
    readonly items: Alert[],
    readonly total: number,
  ) {}

  static fromJson(json: AlertPageJson): AlertPage {
    return new AlertPage(
      json.items.map((item) => Alert.fromJson(item)),
      json.total,
    );
  }
}

/** Number of alerts of a period, in total and per rule code. */
export class AlertStatistics {
  constructor(
    readonly start: Date,
    readonly end: Date,
    readonly total: number,
    readonly perRule: Record<string, number>,
  ) {}

  static fromJson(json: AlertStatisticsJson): AlertStatistics {
    return new AlertStatistics(new Date(json.start), new Date(json.end), json.total, json.per_rule);
  }
}

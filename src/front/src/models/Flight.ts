import { Observation, type ObservationJson } from "@/models/Aircraft";

/** JSON of a flight in a list, as returned by `GET /v1/aircraft/{id}/flights`. */
export interface FlightSummaryJson {
  id: string;
  aircraft_id: string;
  icao24: string;
  registration: string | null;
  callsign: string | null;
  started_at: string;
  ended_at: string | null;
  origin: string | null;
  destination: string | null;
}

export interface FlightStatisticsJson {
  observation_count: number;
  duration_seconds: number;
  distance_km: number;
  mean_altitude: number | null;
  max_altitude: number | null;
  mean_speed: number | null;
  max_speed: number | null;
}

export interface TrajectoryGapJson {
  start: string;
  end: string;
  duration_seconds: number;
}

/** JSON of a flight with its trajectory, as returned by `GET /v1/flights/{id}`. */
export interface FlightDetailJson extends FlightSummaryJson {
  trajectory: ObservationJson[];
  gaps: TrajectoryGapJson[];
  statistics: FlightStatisticsJson;
}

/** Indicators of a flight (BF-08). Altitudes in metres, speeds in m/s. */
export class FlightStatistics {
  constructor(
    readonly observationCount: number,
    readonly durationSeconds: number,
    readonly distanceKm: number,
    readonly meanAltitude: number | null,
    readonly maxAltitude: number | null,
    readonly meanSpeed: number | null,
    readonly maxSpeed: number | null,
  ) {}

  static fromJson(json: FlightStatisticsJson): FlightStatistics {
    return new FlightStatistics(
      json.observation_count,
      json.duration_seconds,
      json.distance_km,
      json.mean_altitude,
      json.max_altitude,
      json.mean_speed,
      json.max_speed,
    );
  }
}

/** A missing segment of the trajectory (UC-02, alternative flow 2a). */
export class TrajectoryGap {
  constructor(
    readonly start: Date,
    readonly end: Date,
    readonly durationSeconds: number,
  ) {}

  static fromJson(json: TrajectoryGapJson): TrajectoryGap {
    return new TrajectoryGap(new Date(json.start), new Date(json.end), json.duration_seconds);
  }
}

/** A flight of an aircraft. */
export class Flight {
  constructor(
    readonly id: string,
    readonly aircraftId: string,
    readonly icao24: string,
    readonly registration: string | null,
    readonly callsign: string | null,
    readonly startedAt: Date,
    readonly endedAt: Date | null,
    readonly origin: string | null,
    readonly destination: string | null,
  ) {}

  static fromJson(json: FlightSummaryJson): Flight {
    return new Flight(
      json.id,
      json.aircraft_id,
      json.icao24,
      json.registration,
      json.callsign,
      new Date(json.started_at),
      json.ended_at ? new Date(json.ended_at) : null,
      json.origin,
      json.destination,
    );
  }

  /** The callsign when known, otherwise the ICAO24 address. */
  get displayName(): string {
    return this.callsign ?? this.icao24.toUpperCase();
  }

  get inProgress(): boolean {
    return this.endedAt === null;
  }
}

/** A flight with its trajectory, its missing segments and its statistics. */
export class FlightDetail extends Flight {
  constructor(
    summary: Flight,
    readonly trajectory: Observation[],
    readonly gaps: TrajectoryGap[],
    readonly statistics: FlightStatistics,
  ) {
    super(
      summary.id,
      summary.aircraftId,
      summary.icao24,
      summary.registration,
      summary.callsign,
      summary.startedAt,
      summary.endedAt,
      summary.origin,
      summary.destination,
    );
  }

  static fromDetailJson(json: FlightDetailJson): FlightDetail {
    return new FlightDetail(
      Flight.fromJson(json),
      json.trajectory.map((point) => Observation.fromJson(point)),
      json.gaps.map((gap) => TrajectoryGap.fromJson(gap)),
      FlightStatistics.fromJson(json.statistics),
    );
  }

  get isPartial(): boolean {
    return this.gaps.length > 0;
  }
}

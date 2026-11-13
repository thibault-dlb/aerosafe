/** JSON of an aircraft, as returned by `GET /v1/aircraft` and `GET /v1/aircraft/{id}`. */
export interface AircraftJson {
  id: string;
  icao24: string;
  registration: string | null;
  model: string | null;
  airline: string | null;
  last_contact_at: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Altitude of the latest observation, in metres. */
  altitude: number | null;
}

/** JSON of one observation: the flight parameters at one time. */
export interface ObservationJson {
  last_contact_at: string;
  position_at: string | null;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  on_ground: boolean;
  flight_id: string | null;
}

/** One observation of an aircraft. A missing value stays `null`. */
export class Observation {
  constructor(
    readonly lastContactAt: Date,
    readonly positionAt: Date | null,
    readonly latitude: number | null,
    readonly longitude: number | null,
    readonly altitude: number | null,
    readonly speed: number | null,
    readonly heading: number | null,
    readonly onGround: boolean,
    readonly flightId: string | null,
  ) {}

  static fromJson(json: ObservationJson): Observation {
    return new Observation(
      new Date(json.last_contact_at),
      json.position_at ? new Date(json.position_at) : null,
      json.latitude,
      json.longitude,
      json.altitude,
      json.speed,
      json.heading,
      json.on_ground,
      json.flight_id,
    );
  }

  get hasPosition(): boolean {
    return this.latitude !== null && this.longitude !== null;
  }
}

/** An aircraft and its latest known position. */
export class Aircraft {
  constructor(
    readonly id: string,
    readonly icao24: string,
    readonly registration: string | null,
    readonly model: string | null,
    readonly airline: string | null,
    readonly lastContactAt: Date | null,
    readonly latitude: number | null,
    readonly longitude: number | null,
    readonly altitude: number | null = null,
  ) {}

  static fromJson(json: AircraftJson): Aircraft {
    return new Aircraft(
      json.id,
      json.icao24,
      json.registration,
      json.model,
      json.airline,
      json.last_contact_at ? new Date(json.last_contact_at) : null,
      json.latitude,
      json.longitude,
      json.altitude,
    );
  }

  /** The registration when known, otherwise the ICAO24 address. */
  get displayName(): string {
    return this.registration ?? this.icao24.toUpperCase();
  }

  get hasPosition(): boolean {
    return this.latitude !== null && this.longitude !== null;
  }
}

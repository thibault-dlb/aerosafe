import type { Aircraft } from "@/models/Aircraft";
import type { Alert, Criticality } from "@/models/Alert";

/** An aircraft as the traffic layer of the map draws it: its latest report and the alert it carries. */
export interface TrafficAircraft {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Metres. */
  altitude: number | null;
  /** True heading, degrees from north. */
  heading: number | null;
  /** Ground speed, metres per second. */
  speed: number | null;
  onGround: boolean | null;
  /** Time of the report, in ms; the position is the one of that instant. */
  contactAt: number | null;
  criticality: Criticality | null;
}

/** One place of the flight of the aircraft that is followed. */
export interface FlightPoint {
  /** Time, in ms. */
  at: number;
  lat: number;
  lon: number;
  /** Metres. */
  altitude: number | null;
}

/** What the card of the followed aircraft shows, read from the map at one instant. */
export interface TrackedSnapshot {
  id: string;
  lat: number;
  lon: number;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  onGround: boolean | null;
  /** Milliseconds since the last report. */
  age: number;
  /** The last report is too old: the aircraft is shown where it was last heard. */
  silent: boolean;
}

/** Turns what the API gave into what the map draws. */
export class TrafficAircraftFactory {
  /** The aircraft with a known position; `alerts` holds the most critical active alert of each aircraft. */
  static from(aircraft: Aircraft[], alerts: Alert[]): TrafficAircraft[] {
    const level = new Map<string, Criticality | null>(alerts.map((alert) => [alert.aircraftId, alert.criticality]));
    const found: TrafficAircraft[] = [];
    for (const item of aircraft) {
      if (item.latitude === null || item.longitude === null) continue;
      found.push({
        id: item.id,
        name: item.displayName,
        lat: item.latitude,
        lon: item.longitude,
        altitude: item.altitude,
        heading: item.heading,
        speed: item.speed,
        onGround: item.onGround,
        contactAt: item.lastContactAt ? item.lastContactAt.getTime() : null,
        criticality: level.get(item.id) ?? null,
      });
    }
    return found;
  }
}

import type { Observation } from "@/models/Aircraft";
import type { FlightPoint } from "@/models/Traffic";

/**
 * Everything known of the flight an aircraft is in: its places and altitudes since the first
 * report of the flight, for the dotted line behind it and the profile of its altitude.
 */
export class FlightHistory {
  /** How many observations are asked for: the most the API gives. */
  static readonly LIMIT = 5000;
  /** Without a flight in the data, two reports further apart than this are not the same flight. */
  static readonly GAP_MS = 30 * 60 * 1000;

  /**
   * The points of the latest flight of `observations` (oldest first, as the API gives them).
   * The flight is the one of the latest observation; without one, the run of observations that
   * follow each other closely, up to the latest.
   */
  static points(observations: Observation[]): FlightPoint[] {
    const latest = observations.at(-1);
    if (!latest) return [];
    let flight: Observation[];
    if (latest.flightId !== null) {
      flight = observations.filter((item) => item.flightId === latest.flightId);
    } else {
      let start = observations.length - 1;
      while (start > 0 && observations[start].lastContactAt.getTime() - observations[start - 1].lastContactAt.getTime() <= FlightHistory.GAP_MS) {
        start -= 1;
      }
      flight = observations.slice(start);
    }
    const points: FlightPoint[] = [];
    for (const item of flight) {
      if (item.latitude === null || item.longitude === null) continue;
      points.push({ at: (item.positionAt ?? item.lastContactAt).getTime(), lat: item.latitude, lon: item.longitude, altitude: item.altitude });
    }
    return points;
  }

  /** The points followed by a new report, when it is newer than the last one. */
  static append(points: FlightPoint[], point: FlightPoint): FlightPoint[] {
    const last = points.at(-1);
    return last && point.at <= last.at ? points : [...points, point];
  }
}

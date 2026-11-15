import { Mercator } from "@/services/Mercator";

/**
 * Where an aircraft was at `at` (a time in ms), and how it moves from there: a straight line in
 * the unit square of Mercator, which is what a constant heading draws on this map.
 */
export interface Motion {
  at: number;
  x: number;
  y: number;
  /** Unit square per millisecond; both 0 for an aircraft that does not move or whose course is unknown. */
  vx: number;
  vy: number;
}

/** A place at an instant: the unit square and the time since the report. */
export interface Estimate {
  x: number;
  y: number;
  /** Milliseconds since the report, never negative. */
  age: number;
  /** The report is too old to be trusted: the aircraft stopped moving on the map. */
  silent: boolean;
}

/**
 * Moves an aircraft from its last report, as if it kept its heading and its ground speed. It is
 * an estimate, not an observation: after `SILENT_MS` without a new report it stops, so a lost
 * aircraft is not drawn flying on for ever. Everything is linear in the unit square, so a frame
 * costs one multiplication per aircraft.
 */
export class DeadReckoning {
  /** How far ahead the line in front of an aircraft goes: 15 minutes. */
  static readonly HORIZON_MS = 15 * 60 * 1000;
  /** Beyond this age a report is no longer carried forward. */
  static readonly SILENT_MS = 90_000;

  /** The motion of an aircraft reported at `at`. Without a heading or a speed, or on the ground, it stays. */
  static motion(
    lat: number,
    lon: number,
    heading: number | null,
    speed: number | null,
    onGround: boolean | null,
    at: number,
  ): Motion {
    const x = Mercator.x(lon);
    const y = Mercator.y(lat);
    if (heading === null || speed === null || speed <= 0 || onGround === true) {
      return { at, x, y, vx: 0, vy: 0 };
    }
    const turn = heading * Mercator.RADIANS;
    // Metres per second to unit square per millisecond: divide by the radius, by cos(lat) (a degree of
    // longitude is shorter away from the equator), by 2π (the world is 2π radians wide) and by 1000.
    const factor = speed / (Mercator.EARTH_RADIUS * Math.cos(lat * Mercator.RADIANS) * 2 * Math.PI * 1000);
    return { at, x, y, vx: Math.sin(turn) * factor, vy: -Math.cos(turn) * factor };
  }

  /** Whether the aircraft goes anywhere. */
  static moving(motion: Motion): boolean {
    return motion.vx !== 0 || motion.vy !== 0;
  }

  /** Where the aircraft is estimated to be at `now`. */
  static at(motion: Motion, now: number): Estimate {
    const age = Math.max(0, now - motion.at);
    const silent = age > DeadReckoning.SILENT_MS;
    const carried = silent ? DeadReckoning.SILENT_MS : age;
    return { x: motion.x + motion.vx * carried, y: motion.y + motion.vy * carried, age, silent };
  }
}

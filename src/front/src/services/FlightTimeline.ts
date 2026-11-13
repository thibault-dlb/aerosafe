import type { FlightRoute, ScenePoint } from "@/services/FlightRoute";

/** Everything the home page scene shows at one scroll position. */
export interface FlightFrame {
  /** Scroll position, 0 to 1. */
  progress: number;
  /** Part of the route already flown, 0 to 1. */
  flight: number;
  introOpacity: number;
  mapOpacity: number;
  /** Part of the coastline already drawn, 0 to 1. */
  outline: number;
  camera: { x: number; y: number; zoom: number };
  plane: ScenePoint & { heading: number };
  /** Track flown before the anomaly, then after it. */
  track: ScenePoint[];
  alertTrack: ScenePoint[];
  /** Metres, metres per second, metres per second, degrees. */
  altitude: number;
  verticalRate: number;
  speed: number;
  heading: number;
  hudOpacity: number;
  alert: boolean;
  alertOpacity: number;
  trackCaptionOpacity: number;
  detectCaptionOpacity: number;
  hintOpacity: number;
}

/**
 * The story told by the home page scene, as a function of the scroll position: the title
 * leaves, the map lights up, an aircraft flies its route, its altitude drops faster than
 * rule R3 allows, and the alert appears. No DOM here: the components only draw the frame.
 */
export class FlightTimeline {
  /** Scroll positions between which the aircraft flies. */
  static readonly FLIGHT_START = 0.18;
  static readonly FLIGHT_END = 0.86;
  /** Fractions of the flight between which the altitude drops. */
  static readonly DROP_START = 0.6;
  static readonly DROP_END = 0.66;
  /** Cruise altitude and altitude after the drop, in metres. */
  static readonly CRUISE_ALTITUDE = 10_970;
  static readonly DROPPED_ALTITUDE = 8_270;
  static readonly FINAL_ALTITUDE = 450;
  /** Vertical rate during the drop and threshold of rule R3, in metres per second. */
  static readonly DROP_RATE = -45;
  static readonly R3_THRESHOLD = 30;
  static readonly MAX_ZOOM = 2.1;

  constructor(
    private readonly route: FlightRoute,
    /** Where the camera looks before and after the flight. */
    private readonly center: ScenePoint,
  ) {}

  static clamp(value: number): number {
    return Math.min(Math.max(value, 0), 1);
  }

  /** 0 before `from`, 1 after `to`, a straight line in between. */
  static ramp(value: number, from: number, to: number): number {
    return FlightTimeline.clamp((value - from) / (to - from));
  }

  /** Like `ramp`, with a soft start and a soft end. */
  static ease(value: number, from: number, to: number): number {
    const t = FlightTimeline.ramp(value, from, to);
    return t * t * (3 - 2 * t);
  }

  /** 1 in the middle of the interval, 0 at both ends, with short slopes. */
  private static plateau(value: number, from: number, to: number): number {
    const t = FlightTimeline.ramp(value, from, to);
    return FlightTimeline.clamp(Math.min(t, 1 - t) * 5);
  }

  /** Altitude in metres at a fraction of the flight. */
  altitude(flight: number): number {
    const { CRUISE_ALTITUDE, DROPPED_ALTITUDE, FINAL_ALTITUDE, DROP_START, DROP_END } = FlightTimeline;
    if (flight < DROP_START) {
      return CRUISE_ALTITUDE * FlightTimeline.ease(flight, 0, 0.16);
    }
    if (flight < DROP_END) {
      const fallen = FlightTimeline.ramp(flight, DROP_START, DROP_END);
      return CRUISE_ALTITUDE + (DROPPED_ALTITUDE - CRUISE_ALTITUDE) * fallen;
    }
    return DROPPED_ALTITUDE + (FINAL_ALTITUDE - DROPPED_ALTITUDE) * FlightTimeline.ease(flight, 0.82, 1);
  }

  /** Vertical rate in metres per second at a fraction of the flight. */
  verticalRate(flight: number): number {
    const { DROP_START, DROP_END, DROP_RATE } = FlightTimeline;
    const climb = 14 * FlightTimeline.plateau(flight, 0, 0.16);
    const drop = DROP_RATE * FlightTimeline.plateau(flight, DROP_START, DROP_END);
    const descent = -9 * FlightTimeline.plateau(flight, 0.82, 1);
    return climb + drop + descent;
  }

  /** Ground speed in metres per second at a fraction of the flight. */
  speed(flight: number): number {
    const takeoff = 150 * FlightTimeline.ease(flight, 0, 0.14);
    const dive = 14 * FlightTimeline.plateau(flight, FlightTimeline.DROP_START, FlightTimeline.DROP_END);
    const approach = 155 * FlightTimeline.ease(flight, 0.84, 1);
    return 80 + takeoff + dive - approach;
  }

  /** The frame to draw at a scroll position (0 to 1, clamped). */
  frame(position: number): FlightFrame {
    const { FLIGHT_START, FLIGHT_END, DROP_START, DROP_END, MAX_ZOOM, ease, ramp } = FlightTimeline;
    const progress = FlightTimeline.clamp(position);
    const flight = ramp(progress, FLIGHT_START, FLIGHT_END);
    const point = this.route.pointAt(flight);
    const heading = this.route.headingAt(flight);

    // The camera closes in on the aircraft for the flight, then steps back to show the country.
    const follow = ease(progress, 0.16, 0.32) * (1 - ease(progress, FLIGHT_END, 0.98));
    const camera = {
      x: this.center.x + (point.x - this.center.x) * follow,
      y: this.center.y + (point.y - this.center.y) * follow,
      zoom: 1 + (MAX_ZOOM - 1) * follow,
    };

    return {
      progress,
      flight,
      introOpacity: 1 - ease(progress, 0.03, 0.13),
      mapOpacity: 0.45 + 0.55 * ease(progress, 0.04, 0.18),
      outline: ease(progress, 0.02, 0.2),
      camera,
      plane: { ...point, heading },
      track: this.route.slice(0, Math.min(flight, DROP_START)),
      alertTrack: this.route.slice(DROP_START, flight),
      altitude: this.altitude(flight),
      verticalRate: this.verticalRate(flight),
      speed: this.speed(flight),
      heading,
      hudOpacity: ease(progress, 0.2, 0.27),
      alert: flight > (DROP_START + DROP_END) / 2,
      alertOpacity: ease(flight, (DROP_START + DROP_END) / 2, DROP_END + 0.03),
      trackCaptionOpacity: ease(progress, 0.2, 0.26) * (1 - ease(progress, 0.52, 0.58)),
      detectCaptionOpacity: ease(progress, 0.63, 0.69),
      hintOpacity: 1 - ease(progress, 0.01, 0.06),
    };
  }
}

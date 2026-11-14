import { RADAR, SceneProjection } from "@/components/home/sceneGeography";

/** One aircraft of the radar of the log in screen, ready to be drawn. */
export interface RadarPlane {
  callsign: string;
  x: number;
  y: number;
  /** Degrees clockwise from the north. */
  heading: number;
  /** Fades in at the start of its flight and out at the end, and brightens when the beam passes. */
  opacity: number;
  /** End of the short line ahead of the aircraft, relative to it. */
  leadX: number;
  leadY: number;
  /** The ring that answers the beam: its radius, and how visible it is. */
  echoRadius: number;
  echoOpacity: number;
}

export interface RadarFrame {
  /** Angle of the beam in degrees, clockwise from the north. */
  beamDegrees: number;
  planes: RadarPlane[];
}

interface Flight {
  callsign: string;
  from: readonly [number, number];
  to: readonly [number, number];
  /** Time to fly the whole way, in seconds. */
  seconds: number;
  /** Share of the flight already done at the start. */
  offset: number;
}

/**
 * The traffic of the radar on the log in screen: a few invented flights across France and the
 * beam that sweeps them. A pure function of time, so the drawing can be checked and the screen
 * can be frozen for people who ask for less motion.
 */
export class RadarFlights {
  static readonly BEAM_SECONDS = 9;
  /** The instant drawn when the animation is off. */
  static readonly STILL_SECONDS = 12.4;
  /** The beam lights an aircraft for this many degrees behind it. */
  private static readonly AFTERGLOW_DEGREES = 150;
  private static readonly LEAD = 0.07;
  private static readonly FADE = 0.08;

  /** Invented callsigns; the routes are longitude and latitude. */
  static readonly FLIGHTS: readonly Flight[] = [
    { callsign: "ASF2041", from: [2.55, 49.01], to: [7.21, 43.66], seconds: 46, offset: 0.1 },
    { callsign: "ASF118", from: [-4.2, 48.3], to: [3.2, 50.2], seconds: 58, offset: 0.55 },
    { callsign: "ASF7702", from: [0.2, 43.4], to: [-1.6, 47.4], seconds: 52, offset: 0.3 },
    { callsign: "ASF390", from: [7.6, 48.4], to: [1.4, 47.0], seconds: 64, offset: 0.8 },
    { callsign: "ASF55", from: [-1.2, 44.9], to: [5.6, 44.0], seconds: 70, offset: 0.45 },
    { callsign: "ASF913", from: [3.2, 43.4], to: [1.6, 49.6], seconds: 61, offset: 0.02 },
  ];

  static frame(seconds: number): RadarFrame {
    const beamDegrees = ((seconds / RadarFlights.BEAM_SECONDS) * 360) % 360;
    return { beamDegrees, planes: RadarFlights.FLIGHTS.map((flight) => RadarFlights.plane(flight, seconds, beamDegrees)) };
  }

  private static plane(flight: Flight, seconds: number, beamDegrees: number): RadarPlane {
    const from = SceneProjection.point(...flight.from);
    const to = SceneProjection.point(...flight.to);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const progress = (seconds / flight.seconds + flight.offset) % 1;
    const x = from.x + dx * progress;
    const y = from.y + dy * progress;

    // How far behind the beam the aircraft is: just swept is bright, long ago is dim.
    const bearing = (((Math.atan2(x - RADAR.x, -(y - RADAR.y)) * 180) / Math.PI) + 360) % 360;
    const behind = (beamDegrees - bearing + 360) % 360;
    const glow = Math.max(0, 1 - behind / RadarFlights.AFTERGLOW_DEGREES);
    const edge = Math.min(1, progress / RadarFlights.FADE, (1 - progress) / RadarFlights.FADE);

    return {
      callsign: flight.callsign,
      x,
      y,
      heading: (Math.atan2(dx, -dy) * 180) / Math.PI,
      opacity: edge * (0.5 + 0.5 * glow),
      leadX: dx * RadarFlights.LEAD,
      leadY: dy * RadarFlights.LEAD,
      echoRadius: 14 + (1 - glow) * 26,
      echoOpacity: glow > 0.55 ? (glow - 0.55) * 1.6 : 0,
    };
  }
}

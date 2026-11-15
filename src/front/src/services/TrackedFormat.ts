import type { FlightPoint } from "@/models/Traffic";

/** How the card of the followed aircraft writes a place and draws the altitude of its flight. */
export class TrackedFormat {
  /** The place as "48.8534° N  2.3488° E". */
  static coordinates(lat: number, lon: number): string {
    return `${Math.abs(lat).toFixed(4)}° ${lat < 0 ? "S" : "N"}  ${Math.abs(lon).toFixed(4)}° ${lon < 0 ? "W" : "E"}`;
  }

  /**
   * The altitude profile of a flight as the points of a polyline in a box of `width` by `height`, and
   * the highest altitude it reaches (at least 1 000 m, so a flat flight does not fill the box). Null
   * when fewer than two points have an altitude.
   */
  static profile(history: FlightPoint[], width: number, height: number): { line: string; peak: number } | null {
    const known = history.filter((point) => point.altitude !== null);
    if (known.length < 2) return null;
    const first = known[0].at;
    const span = Math.max(known[known.length - 1].at - first, 1);
    const peak = Math.max(...known.map((point) => point.altitude as number), 1000);
    const line = known
      .map((point) => {
        const x = ((point.at - first) / span) * width;
        const y = height - 4 - (((point.altitude as number) / peak) * (height - 8));
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    return { line, peak };
  }
}

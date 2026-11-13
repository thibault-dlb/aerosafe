/** A point of the home page scene, in the units of its SVG view box. */
export interface ScenePoint {
  x: number;
  y: number;
}

/**
 * The route of the aircraft shown on the home page: a smooth curve through a few waypoints,
 * read by fraction of its length (0 at the departure, 1 at the arrival).
 */
export class FlightRoute {
  private readonly points: ScenePoint[];
  /** Distance from the departure to each point. */
  private readonly distances: number[];

  constructor(waypoints: ScenePoint[], samplesPerSegment = 24) {
    if (waypoints.length < 2) {
      throw new Error("A route needs at least two waypoints");
    }
    this.points = FlightRoute.smooth(waypoints, samplesPerSegment);
    this.distances = [0];
    for (let index = 1; index < this.points.length; index += 1) {
      const from = this.points[index - 1];
      const to = this.points[index];
      this.distances.push(this.distances[index - 1] + Math.hypot(to.x - from.x, to.y - from.y));
    }
  }

  /** Catmull-Rom curve through the waypoints, as a list of close points. */
  private static smooth(waypoints: ScenePoint[], samples: number): ScenePoint[] {
    const points: ScenePoint[] = [];
    const last = waypoints.length - 1;
    for (let index = 0; index < last; index += 1) {
      const p0 = waypoints[Math.max(index - 1, 0)];
      const p1 = waypoints[index];
      const p2 = waypoints[index + 1];
      const p3 = waypoints[Math.min(index + 2, last)];
      for (let step = 0; step < samples; step += 1) {
        const t = step / samples;
        points.push({
          x: FlightRoute.spline(p0.x, p1.x, p2.x, p3.x, t),
          y: FlightRoute.spline(p0.y, p1.y, p2.y, p3.y, t),
        });
      }
    }
    points.push(waypoints[last]);
    return points;
  }

  private static spline(a: number, b: number, c: number, d: number, t: number): number {
    return (
      0.5 *
      (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t)
    );
  }

  /** The SVG path data of a list of points. */
  static toPath(points: ScenePoint[]): string {
    return points
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
      .join("");
  }

  /** Total length of the route. */
  get length(): number {
    return this.distances[this.distances.length - 1];
  }

  /** Index of the segment that holds the fraction, and the position inside it (0 to 1). */
  private locate(fraction: number): { index: number; within: number } {
    const target = Math.min(Math.max(fraction, 0), 1) * this.length;
    let index = 1;
    while (index < this.distances.length - 1 && this.distances[index] < target) {
      index += 1;
    }
    const span = this.distances[index] - this.distances[index - 1];
    return { index, within: span === 0 ? 0 : (target - this.distances[index - 1]) / span };
  }

  /** Position at a fraction of the route. */
  pointAt(fraction: number): ScenePoint {
    const { index, within } = this.locate(fraction);
    const from = this.points[index - 1];
    const to = this.points[index];
    return { x: from.x + (to.x - from.x) * within, y: from.y + (to.y - from.y) * within };
  }

  /** Heading at a fraction of the route, in degrees clockwise from the north (top of the scene). */
  headingAt(fraction: number): number {
    const { index } = this.locate(fraction);
    const from = this.points[index - 1];
    const to = this.points[index];
    const degrees = (Math.atan2(to.x - from.x, from.y - to.y) * 180) / Math.PI;
    return (degrees + 360) % 360;
  }

  /** The points of the route between two fractions, both ends included. */
  slice(from: number, to: number): ScenePoint[] {
    if (to <= from) {
      return [];
    }
    const start = this.locate(from);
    const end = this.locate(to);
    return [this.pointAt(from), ...this.points.slice(start.index, end.index), this.pointAt(to)];
  }
}

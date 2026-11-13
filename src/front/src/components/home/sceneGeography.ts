import type { ScenePoint } from "@/services/FlightRoute";

/**
 * Geography of the home page scene. The coastline is a hand-simplified outline of
 * metropolitan France (longitude, latitude): it is a drawing, not a map to measure on.
 */

/** Places longitudes and latitudes in the SVG view box of the scene. */
export class SceneProjection {
  /** View box of the scene: France fits in it with a margin under the top bar. */
  static readonly VIEW_BOX = "0 -70 1000 1110";
  static readonly CENTER: ScenePoint = { x: 500, y: 485 };

  private static readonly WEST = -5.5;
  private static readonly NORTH = 51.5;
  /** Scene units per degree of latitude. */
  private static readonly SCALE = 90;
  /** Cosine of the mean latitude (46.5°): keeps the proportions of the country. */
  private static readonly SQUEEZE = 0.688;

  static point(longitude: number, latitude: number): ScenePoint {
    return {
      x: 20 + (longitude - SceneProjection.WEST) * SceneProjection.SQUEEZE * SceneProjection.SCALE,
      y: 28 + (SceneProjection.NORTH - latitude) * SceneProjection.SCALE,
    };
  }

  static points(coordinates: readonly (readonly [number, number])[]): ScenePoint[] {
    return coordinates.map(([longitude, latitude]) => SceneProjection.point(longitude, latitude));
  }
}

type Coordinates = readonly (readonly [number, number])[];

/** Mainland coastline and borders, clockwise from Dunkirk. */
export const MAINLAND: Coordinates = [
  [2.55, 51.09], [3.15, 50.78], [3.65, 50.45], [4.2, 50.25], [4.15, 49.98], [4.82, 50.15],
  [4.85, 49.8], [5.8, 49.55], [6.35, 49.47], [7.4, 49.17], [8.23, 48.97], [7.8, 48.55],
  [7.55, 48.0], [7.59, 47.59], [7.0, 47.45], [6.75, 47.1], [6.1, 46.6], [6.1, 46.25],
  [5.97, 46.2], [6.3, 46.4], [6.8, 46.4], [7.04, 45.92], [6.8, 45.75], [7.1, 45.4],
  [6.63, 45.1], [7.07, 44.68], [6.9, 44.35], [7.7, 44.15], [7.53, 43.78], [7.27, 43.69],
  [7.12, 43.55], [6.7, 43.2], [6.2, 43.08], [5.93, 43.08], [5.35, 43.3], [4.9, 43.4],
  [4.6, 43.36], [4.1, 43.55], [3.7, 43.4], [3.5, 43.28], [3.1, 43.0], [3.04, 42.6],
  [3.17, 42.43], [2.6, 42.35], [2.0, 42.35], [1.75, 42.5], [1.45, 42.6], [0.7, 42.7],
  [-0.3, 42.8], [-0.75, 42.95], [-1.3, 43.05], [-1.78, 43.37], [-1.56, 43.48], [-1.4, 43.9],
  [-1.3, 44.3], [-1.25, 44.65], [-1.15, 45.1], [-1.1, 45.55], [-0.8, 45.4], [-1.05, 45.62],
  [-1.2, 46.15], [-1.5, 46.35], [-1.8, 46.5], [-2.15, 46.9], [-2.0, 47.1], [-2.2, 47.27],
  [-2.5, 47.3], [-2.8, 47.5], [-3.1, 47.5], [-3.4, 47.7], [-3.9, 47.85], [-4.37, 47.8],
  [-4.73, 48.04], [-4.3, 48.1], [-4.6, 48.25], [-4.3, 48.35], [-4.78, 48.36], [-4.7, 48.6],
  [-3.98, 48.73], [-3.5, 48.85], [-3.0, 48.85], [-2.7, 48.55], [-2.3, 48.65], [-2.0, 48.65],
  [-1.5, 48.63], [-1.6, 48.84], [-1.55, 49.2], [-1.8, 49.4], [-1.94, 49.72], [-1.6, 49.65],
  [-1.26, 49.7], [-1.15, 49.35], [-0.4, 49.33], [-0.1, 49.3], [0.1, 49.5], [0.2, 49.7],
  [1.08, 49.93], [1.55, 50.2], [1.58, 50.72], [1.58, 50.87], [1.85, 50.96],
];

export const CORSICA: Coordinates = [
  [9.35, 43.0], [9.48, 42.7], [9.55, 42.1], [9.4, 41.6], [9.17, 41.38], [8.8, 41.55],
  [8.6, 41.9], [8.55, 42.35], [8.75, 42.57], [9.1, 42.73], [9.3, 42.7],
];

export interface SceneCity {
  name: string;
  point: ScenePoint;
  /** Side of the dot where the name is written. */
  side: "left" | "right";
}

export const CITIES: SceneCity[] = [
  { name: "Paris", point: SceneProjection.point(2.35, 48.86), side: "left" },
  { name: "Lyon", point: SceneProjection.point(4.84, 45.76), side: "left" },
  { name: "Marseille", point: SceneProjection.point(5.37, 43.3), side: "left" },
  { name: "Nice", point: SceneProjection.point(7.26, 43.7), side: "right" },
  { name: "Toulouse", point: SceneProjection.point(1.44, 43.6), side: "left" },
  { name: "Bordeaux", point: SceneProjection.point(-0.58, 44.84), side: "right" },
  { name: "Nantes", point: SceneProjection.point(-1.55, 47.22), side: "right" },
  { name: "Brest", point: SceneProjection.point(-4.49, 48.39), side: "right" },
  { name: "Lille", point: SceneProjection.point(3.06, 50.63), side: "left" },
  { name: "Strasbourg", point: SceneProjection.point(7.75, 48.58), side: "left" },
];

/** Centre of the radar rings. */
export const RADAR: ScenePoint = SceneProjection.point(2.35, 48.86);

/** Route of the aircraft: Paris-Charles de Gaulle to Nice, east of Lyon then over the Alps. */
export const ROUTE_WAYPOINTS: ScenePoint[] = SceneProjection.points([
  [2.55, 49.01], [3.15, 48.1], [4.1, 46.9], [5.2, 45.75], [6.1, 44.75], [6.75, 44.0], [7.21, 43.66],
]);

/** Other traffic, as faint dots that drift with the scroll: start and end of each one. */
export const TRAFFIC: { from: ScenePoint; to: ScenePoint }[] = [
  { from: SceneProjection.point(-3.8, 48.2), to: SceneProjection.point(0.4, 49.6) },
  { from: SceneProjection.point(0.2, 43.4), to: SceneProjection.point(-1.4, 46.8) },
  { from: SceneProjection.point(5.6, 49.2), to: SceneProjection.point(1.2, 47.4) },
  { from: SceneProjection.point(-1.2, 45.0), to: SceneProjection.point(3.0, 44.2) },
  { from: SceneProjection.point(7.6, 47.9), to: SceneProjection.point(4.4, 48.9) },
  { from: SceneProjection.point(2.0, 50.6), to: SceneProjection.point(-0.8, 48.1) },
  { from: SceneProjection.point(3.6, 43.5), to: SceneProjection.point(1.9, 45.9) },
  { from: SceneProjection.point(9.6, 44.6), to: SceneProjection.point(8.9, 42.0) },
];

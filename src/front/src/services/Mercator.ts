/** What is needed to turn a place into a pixel: the centre of the view, its zoom and its size. */
export interface MapView {
  /** Latitude of the centre, in degrees. */
  lat: number;
  /** Longitude of the centre, in degrees. */
  lon: number;
  /** Zoom level, as Leaflet counts it: the world is `256 * 2^zoom` pixels wide. */
  zoom: number;
  /** Width and height of the map, in CSS pixels. */
  width: number;
  height: number;
}

/**
 * Web Mercator, the projection of Leaflet, on the unit square: `x` and `y` go from 0 to 1 over the
 * world, `y` growing to the south. A heading kept constant is a straight line in this square, which
 * is why the aircraft are moved in it (see `DeadReckoning`).
 */
export class Mercator {
  static readonly TILE = 256;
  /** Radius of the Earth, in metres. */
  static readonly EARTH_RADIUS = 6_371_000;
  static readonly RADIANS = Math.PI / 180;
  /** The latitude the projection stops at. */
  static readonly MAX_LATITUDE = 85.0511287798;

  static x(lon: number): number {
    return (lon + 180) / 360;
  }

  static y(lat: number): number {
    const clamped = Math.max(-Mercator.MAX_LATITUDE, Math.min(Mercator.MAX_LATITUDE, lat));
    return 0.5 - Math.log(Math.tan(Math.PI / 4 + (clamped * Mercator.RADIANS) / 2)) / (2 * Math.PI);
  }

  static lon(x: number): number {
    return x * 360 - 180;
  }

  static lat(y: number): number {
    return ((Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - Math.PI / 4) * 2) / Mercator.RADIANS;
  }

  /** Pixels in the whole world at `zoom`. */
  static scale(zoom: number): number {
    return Mercator.TILE * 2 ** zoom;
  }

  /** The pixel of a place in the view. */
  static toScreen(view: MapView, lat: number, lon: number): { x: number; y: number } {
    const scale = Mercator.scale(view.zoom);
    return {
      x: (Mercator.x(lon) - Mercator.x(view.lon)) * scale + view.width / 2,
      y: (Mercator.y(lat) - Mercator.y(view.lat)) * scale + view.height / 2,
    };
  }

  /** The place under a pixel of the view. */
  static fromScreen(view: MapView, x: number, y: number): { lat: number; lon: number } {
    const scale = Mercator.scale(view.zoom);
    return {
      lat: Mercator.lat(Mercator.y(view.lat) + (y - view.height / 2) / scale),
      lon: Mercator.lon(Mercator.x(view.lon) + (x - view.width / 2) / scale),
    };
  }

  /** The point `metres` away from a place along a great circle, on `bearing` degrees from north. */
  static destination(lat: number, lon: number, bearing: number, metres: number): { lat: number; lon: number } {
    const r = Mercator.RADIANS;
    const angle = metres / Mercator.EARTH_RADIUS;
    const from = lat * r;
    const heading = bearing * r;
    const to = Math.asin(Math.sin(from) * Math.cos(angle) + Math.cos(from) * Math.sin(angle) * Math.cos(heading));
    const along = Math.atan2(
      Math.sin(heading) * Math.sin(angle) * Math.cos(from),
      Math.cos(angle) - Math.sin(from) * Math.sin(to),
    );
    return { lat: to / r, lon: lon + along / r };
  }
}

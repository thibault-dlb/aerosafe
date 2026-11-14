/** A line or the outer ring of a polygon: longitude and latitude pairs, in degrees. */
export type GeoLine = [number, number][];

/** `assets/map/basemap.json`, made by `scripts/build_basemap.py`. */
export interface BasemapJson {
  land: GeoLine[];
  lakes: GeoLine[];
  urban: GeoLine[];
  rivers: GeoLine[];
  /** The border of the area the historical data covers: France without Corsica, plus 100 km. */
  area: GeoLine[];
}

/** `assets/map/airports.json`. A runway is `[lat, lon, lat, lon]`, its two ends. */
export interface AirportJson {
  icao: string;
  name: string;
  lat: number;
  lon: number;
  large: boolean;
  runways: [number, number, number, number][];
}

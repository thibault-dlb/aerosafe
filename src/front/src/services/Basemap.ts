import type { AirportJson, BasemapJson, GeoLine } from "@/models/Basemap";
import type { MapColors } from "@/services/MapTheme";
import { type MapView, Mercator } from "@/services/Mercator";

/** A geographic area in degrees (WGS 84). */
export interface ZoneArea {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** The zone of the collection drawn on the map: the outline of the historical data, a rectangle, or none. */
export type Zone = "outline" | ZoneArea | null;

/** A line or a ring in the unit square of Mercator, with its box, so a draw can skip what is out of view. */
class Shape {
  readonly points: Float64Array;
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;

  constructor(line: GeoLine) {
    this.points = new Float64Array(line.length * 2);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    line.forEach(([lon, lat], index) => {
      const x = Mercator.x(lon);
      const y = Mercator.y(lat);
      this.points[index * 2] = x;
      this.points[index * 2 + 1] = y;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });
    this.minX = minX;
    this.maxX = maxX;
    this.minY = minY;
    this.maxY = maxY;
  }
}

/** Where a draw puts the unit square on the screen. */
interface Frame {
  scale: number;
  /** Pixel of the world origin (0, 0). */
  ox: number;
  oy: number;
  width: number;
  height: number;
}

const FONT = '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, Consolas, monospace';

/**
 * The map of the dashboard, drawn from small files instead of tiles: coasts and borders, rivers,
 * lakes, urban areas, a graticule, range rings around Paris, the airports with their runways and
 * the zone of the collection. It is dark and has no road, a radar screen more than a road map.
 * Nothing is fetched: the files are part of the front end, and the map works offline.
 */
export class Basemap {
  /** Range rings are drawn around Paris, every 50 nautical miles. */
  static readonly CENTER = { lat: 48.8534, lon: 2.3488 };
  static readonly RING_METRES = 50 * 1852;
  static readonly RINGS = 8;

  private readonly land: Shape[];
  private readonly lakes: Shape[];
  private readonly urban: Shape[];
  private readonly rivers: Shape[];
  private readonly area: Shape[];
  private readonly airports: (AirportJson & { x: number; y: number })[];

  constructor(data: BasemapJson, airports: AirportJson[]) {
    this.land = data.land.map((line) => new Shape(line));
    this.lakes = data.lakes.map((line) => new Shape(line));
    this.urban = data.urban.map((line) => new Shape(line));
    this.rivers = data.rivers.map((line) => new Shape(line));
    this.area = data.area.map((line) => new Shape(line));
    this.airports = airports.map((airport) => ({ ...airport, x: Mercator.x(airport.lon), y: Mercator.y(airport.lat) }));
  }

  /** Loads the files. They are a separate chunk of the build, fetched when the first map opens. */
  static async load(): Promise<Basemap> {
    const [basemap, airports] = await Promise.all([
      import("@/assets/map/basemap.json"),
      import("@/assets/map/airports.json"),
    ]);
    return new Basemap(basemap.default as unknown as BasemapJson, airports.default as unknown as AirportJson[]);
  }

  get airportCount(): number {
    return this.airports.length;
  }

  /** The step of the graticule, in degrees, for a zoom. */
  static graticuleStep(zoom: number): number {
    if (zoom < 5.2) return 5;
    if (zoom < 8.5) return 1;
    return zoom < 10.5 ? 0.25 : 0.1;
  }

  /** Draws the whole map in `context`, which covers `view.width` by `view.height` CSS pixels. */
  draw(context: CanvasRenderingContext2D, view: MapView, colors: MapColors, zone: Zone): void {
    const scale = Mercator.scale(view.zoom);
    const frame: Frame = {
      scale,
      ox: view.width / 2 - Mercator.x(view.lon) * scale,
      oy: view.height / 2 - Mercator.y(view.lat) * scale,
      width: view.width,
      height: view.height,
    };
    context.fillStyle = colors.outline;
    context.fillRect(0, 0, view.width, view.height);

    this.trace(context, this.land, frame, true);
    context.fillStyle = colors.land;
    context.fill();
    if (view.zoom >= 5.5) {
      this.trace(context, this.urban, frame, true);
      context.fillStyle = colors.urban;
      context.fill();
    }
    this.trace(context, this.lakes, frame, true);
    context.fillStyle = colors.outline;
    context.fill();
    this.trace(context, this.rivers, frame, false);
    context.strokeStyle = colors.water;
    context.lineWidth = view.zoom > 8 ? 2 : 1.2;
    context.stroke();
    this.trace(context, this.land, frame, true);
    context.strokeStyle = colors.border;
    context.lineWidth = 1;
    context.stroke();

    this.drawGraticule(context, view, frame, colors);
    this.drawRings(context, frame, colors);
    this.drawZone(context, frame, colors, zone);
    this.drawAirports(context, view, frame, colors);
  }

  /** The path of the shapes in view, thinned to what a pixel can show. */
  private trace(context: CanvasRenderingContext2D, shapes: Shape[], frame: Frame, fill: boolean): void {
    const margin = 8;
    context.beginPath();
    for (const shape of shapes) {
      const x0 = shape.minX * frame.scale + frame.ox;
      const x1 = shape.maxX * frame.scale + frame.ox;
      const y0 = shape.minY * frame.scale + frame.oy;
      const y1 = shape.maxY * frame.scale + frame.oy;
      if (x1 < -margin || x0 > frame.width + margin || y1 < -margin || y0 > frame.height + margin) continue;
      if (fill && x1 - x0 < 0.8 && y1 - y0 < 0.8) continue;
      const { points } = shape;
      const last = points.length / 2 - 1;
      let lastX = Number.NaN;
      let lastY = Number.NaN;
      for (let index = 0; index <= last; index++) {
        const x = points[index * 2] * frame.scale + frame.ox;
        const y = points[index * 2 + 1] * frame.scale + frame.oy;
        if (index > 0 && index < last && Math.abs(x - lastX) < 0.7 && Math.abs(y - lastY) < 0.7) continue;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
        lastX = x;
        lastY = y;
      }
      if (fill) context.closePath();
    }
  }

  private static degrees(value: number, step: number): string {
    return String(Number(value.toFixed(step < 1 ? 2 : 0)));
  }

  private drawGraticule(context: CanvasRenderingContext2D, view: MapView, frame: Frame, colors: MapColors): void {
    const step = Basemap.graticuleStep(view.zoom);
    const northWest = Mercator.fromScreen(view, 0, 0);
    const southEast = Mercator.fromScreen(view, view.width, view.height);
    context.font = `10px ${FONT}`;
    context.fillStyle = colors.text;
    context.strokeStyle = colors.grid;
    context.lineWidth = 1;
    context.beginPath();
    const labels: [string, number, number][] = [];
    for (let lon = Math.ceil(northWest.lon / step) * step; lon <= southEast.lon; lon += step) {
      const x = Math.round(Mercator.x(lon) * frame.scale + frame.ox) + 0.5;
      context.moveTo(x, 0);
      context.lineTo(x, view.height);
      labels.push([`${Basemap.degrees(Math.abs(lon), step)}°${lon < 0 ? "W" : "E"}`, x + 3, view.height - 20]);
    }
    for (let lat = Math.floor(northWest.lat / step) * step; lat >= southEast.lat; lat -= step) {
      const y = Math.round(Mercator.y(lat) * frame.scale + frame.oy) + 0.5;
      context.moveTo(0, y);
      context.lineTo(view.width, y);
      labels.push([`${Basemap.degrees(Math.abs(lat), step)}°${lat < 0 ? "S" : "N"}`, 4, y - 3]);
    }
    context.stroke();
    context.globalAlpha = 0.55;
    for (const [text, x, y] of labels) context.fillText(text, x, y);
    context.globalAlpha = 1;
  }

  private drawRings(context: CanvasRenderingContext2D, frame: Frame, colors: MapColors): void {
    context.strokeStyle = colors.rings;
    context.fillStyle = colors.text;
    context.font = `10px ${FONT}`;
    context.lineWidth = 1;
    context.setLineDash([2, 5]);
    const { lat, lon } = Basemap.CENTER;
    for (let ring = 1; ring <= Basemap.RINGS; ring++) {
      const metres = ring * Basemap.RING_METRES;
      context.beginPath();
      for (let bearing = 0; bearing <= 360; bearing += 3) {
        const point = Mercator.destination(lat, lon, bearing, metres);
        const x = Mercator.x(point.lon) * frame.scale + frame.ox;
        const y = Mercator.y(point.lat) * frame.scale + frame.oy;
        if (bearing === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.globalAlpha = 0.7;
      context.stroke();
      const top = Mercator.destination(lat, lon, 0, metres);
      context.globalAlpha = 0.8;
      context.fillText(`${ring * 50} NM`, Mercator.x(top.lon) * frame.scale + frame.ox + 4, Mercator.y(top.lat) * frame.scale + frame.oy - 3);
    }
    context.setLineDash([]);
    context.globalAlpha = 1;
  }

  private drawZone(context: CanvasRenderingContext2D, frame: Frame, colors: MapColors, zone: Zone): void {
    if (zone === null) return;
    context.beginPath();
    if (zone === "outline") {
      for (const shape of this.area) {
        const { points } = shape;
        for (let index = 0; index < points.length / 2; index++) {
          const x = points[index * 2] * frame.scale + frame.ox;
          const y = points[index * 2 + 1] * frame.scale + frame.oy;
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.closePath();
      }
    } else {
      const x0 = Mercator.x(zone.west) * frame.scale + frame.ox;
      const x1 = Mercator.x(zone.east) * frame.scale + frame.ox;
      const y0 = Mercator.y(zone.north) * frame.scale + frame.oy;
      const y1 = Mercator.y(zone.south) * frame.scale + frame.oy;
      context.rect(x0, y0, x1 - x0, y1 - y0);
    }
    context.fillStyle = colors.selected;
    context.globalAlpha = 0.05;
    context.fill();
    context.globalAlpha = 0.6;
    context.strokeStyle = colors.selected;
    context.lineWidth = 1.4;
    context.setLineDash([8, 6]);
    context.stroke();
    context.setLineDash([]);
    context.globalAlpha = 1;
  }

  private drawAirports(context: CanvasRenderingContext2D, view: MapView, frame: Frame, colors: MapColors): void {
    const { zoom } = view;
    context.strokeStyle = colors.text;
    context.lineCap = "round";
    for (const airport of this.airports) {
      const x = airport.x * frame.scale + frame.ox;
      const y = airport.y * frame.scale + frame.oy;
      if (x < -40 || y < -40 || x > view.width + 40 || y > view.height + 40) continue;
      if (!airport.large && zoom < 7) continue;
      if (zoom >= 8.5 && airport.runways.length > 0) {
        context.lineWidth = zoom > 10 ? 3 : 1.6;
        context.beginPath();
        for (const [lat0, lon0, lat1, lon1] of airport.runways) {
          context.moveTo(Mercator.x(lon0) * frame.scale + frame.ox, Mercator.y(lat0) * frame.scale + frame.oy);
          context.lineTo(Mercator.x(lon1) * frame.scale + frame.ox, Mercator.y(lat1) * frame.scale + frame.oy);
        }
        context.stroke();
      }
      const size = airport.large ? 5 : 3.5;
      context.lineWidth = 1.3;
      context.fillStyle = colors.outline;
      context.beginPath();
      context.arc(x, y, size, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      if (airport.large) {
        context.beginPath();
        context.moveTo(x - size - 3, y);
        context.lineTo(x + size + 3, y);
        context.moveTo(x, y - size - 3);
        context.lineTo(x, y + size + 3);
        context.stroke();
      }
      if (airport.large || zoom >= 7.6) {
        context.font = `${airport.large ? "600 11px" : "10px"} ${FONT}`;
        context.fillStyle = colors.text;
        context.fillText(airport.icao, x + size + 5, y + 4);
      }
    }
    context.lineCap = "butt";
  }
}

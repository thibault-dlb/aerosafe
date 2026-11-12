import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { MapTheme } from "@/services/MapTheme";

export interface MapPosition {
  latitude: number;
  longitude: number;
  /** Optional text shown in the marker's popup, for example the aircraft registration. */
  label?: string;
  /** Optional altitude in metres: it sets the shade of the marker (low, middle, high). */
  altitude?: number | null;
}

/** OpenStreetMap tiles. The credit is required by the ODbL; OpenSky by its terms (§4 i). */
export const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' +
  ' | Data: <a href="https://opensky-network.org">The OpenSky Network</a>';

/** Centre of the Île-de-France collection area, shown before anything is drawn. */
export const DEFAULT_CENTER: L.LatLngTuple = [48.7, 2.5];
export const DEFAULT_ZOOM = 8;

function toLatLng(position: MapPosition): L.LatLngTuple {
  return [position.latitude, position.longitude];
}

/**
 * Draws aircraft and trajectories with Leaflet. Leaflet is used directly, without
 * `react-leaflet`, whose licence is not open source (D-01). The colours come from the
 * `--map-*` tokens through `MapTheme`, and are redrawn when the theme changes.
 */
export class MapService {
  private map: L.Map | null = null;
  private readonly aircraftLayer = L.layerGroup();
  private readonly trajectoryLayer = L.layerGroup();
  private themeObserver: MutationObserver | null = null;
  private aircraft: MapPosition[] = [];
  private segments: MapPosition[][] = [];

  constructor(private readonly theme: MapTheme = new MapTheme()) {}

  /** Creates the map inside `container`. Call it once, before drawing. */
  mount(container: HTMLElement): void {
    if (this.map) {
      throw new Error("The map is already mounted");
    }
    this.map = L.map(container, { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
    L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 18 }).addTo(this.map);
    this.aircraftLayer.addTo(this.map);
    this.trajectoryLayer.addTo(this.map);

    this.themeObserver = new MutationObserver(() => this.redraw());
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
  }

  /** Replaces the aircraft markers. */
  showAircraft(positions: MapPosition[]): void {
    const map = this.requireMap();
    this.aircraft = positions;
    this.drawAircraft();
    this.fit(map, positions);
  }

  /** Replaces the trajectory with one continuous line. */
  showTrajectory(points: MapPosition[]): void {
    this.showSegments([points]);
  }

  /**
   * Replaces the trajectory with separate lines, so the missing segments of a partial
   * trajectory are not drawn (UC-02, alternative flow 2a).
   */
  showSegments(segments: MapPosition[][]): void {
    const map = this.requireMap();
    this.segments = segments;
    this.drawSegments();
    this.fit(map, segments.flat());
  }

  /** Removes the map and frees its resources. Safe to call more than once. */
  destroy(): void {
    this.themeObserver?.disconnect();
    this.themeObserver = null;
    this.map?.remove();
    this.map = null;
  }

  get mounted(): boolean {
    return this.map !== null;
  }

  /** Number of drawn aircraft markers and trajectory lines, for tests and accessibility. */
  get counts(): { aircraft: number; segments: number } {
    return {
      aircraft: this.aircraftLayer.getLayers().length,
      segments: this.trajectoryLayer.getLayers().length,
    };
  }

  /** Fill colours of the drawn aircraft markers, for tests. */
  get aircraftColors(): string[] {
    return this.aircraftLayer
      .getLayers()
      .map((layer) => (layer as L.CircleMarker).options.fillColor ?? "");
  }

  private drawAircraft(): void {
    const colors = this.theme.colors();
    this.aircraftLayer.clearLayers();
    for (const position of this.aircraft) {
      const color = this.theme.aircraftColor(position.altitude, colors);
      const marker = L.circleMarker(toLatLng(position), {
        radius: 6,
        color,
        fillColor: color,
        fillOpacity: 0.9,
        weight: 2,
      });
      if (position.label) {
        marker.bindPopup(position.label);
      }
      this.aircraftLayer.addLayer(marker);
    }
  }

  private drawSegments(): void {
    const { selected } = this.theme.colors();
    this.trajectoryLayer.clearLayers();
    for (const segment of this.segments) {
      if (segment.length > 0) {
        this.trajectoryLayer.addLayer(L.polyline(segment.map(toLatLng), { color: selected, weight: 3 }));
      }
    }
  }

  /** Draws again with the colours of the theme in use, without moving the view. */
  private redraw(): void {
    this.drawAircraft();
    this.drawSegments();
  }

  private fit(map: L.Map, positions: MapPosition[]): void {
    if (positions.length === 1) {
      map.setView(toLatLng(positions[0]), Math.max(map.getZoom(), 10));
    } else if (positions.length > 1) {
      map.fitBounds(L.latLngBounds(positions.map(toLatLng)), { padding: [24, 24] });
    }
  }

  private requireMap(): L.Map {
    if (!this.map) {
      throw new Error("The map is not mounted");
    }
    return this.map;
  }
}

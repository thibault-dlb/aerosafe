import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { Criticality } from "@/models/Alert";
import type { Zone } from "@/services/Basemap";
import { BasemapLayer } from "@/services/BasemapLayer";
import { MarkerIcon } from "@/services/MarkerIcon";
import { MapTheme } from "@/services/MapTheme";

export interface MapPosition {
  latitude: number;
  longitude: number;
  /** Optional text shown in the marker's popup, for example the aircraft registration. */
  label?: string;
  /** Optional altitude in metres: it sets the shade of the marker (low, middle, high). */
  altitude?: number | null;
  /** Optional true heading in degrees from north: the silhouette turns with it. */
  heading?: number | null;
  /** An aircraft on the ground is drawn as a diamond. */
  onGround?: boolean | null;
  /** Criticality of the active alert of the aircraft: the marker takes its colour and pulses. */
  criticality?: Criticality | null;
  /** The aircraft the user picked: it gets a dashed ring. */
  selected?: boolean;
}

/** A geographic area in degrees (WGS 84), as drawn on the map by the user. */
export interface MapArea {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** The credits of the drawn map (public domain data) and of the traffic (OpenSky's terms, §4 i). */
export const ATTRIBUTION =
  '<a href="https://www.naturalearthdata.com">Natural Earth</a> | <a href="https://ourairports.com">OurAirports</a>' +
  ' | Data: <a href="https://opensky-network.org">The OpenSky Network</a>';

/** Centre of the Île-de-France collection area, shown before anything is drawn. */
export const DEFAULT_CENTER: L.LatLngTuple = [48.7, 2.5];
export const DEFAULT_ZOOM = 8;

/** What the base map draws: western Europe (`scripts/build_basemap.py`). The view never leaves it. */
export const MAP_FRAME: L.LatLngBoundsLiteral = [
  [39.5, -9],
  [54, 13],
];

function toLatLng(position: MapPosition): L.LatLngTuple {
  return [position.latitude, position.longitude];
}

function toArea(bounds: L.LatLngBounds): MapArea {
  return { south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast() };
}

/**
 * Draws aircraft and trajectories with Leaflet. Leaflet is used directly, without
 * `react-leaflet`, whose licence is not open source (D-01). The colours come from the
 * `--map-*` tokens through `MapTheme`. The application has one theme, so they are read once.
 */
export class MapService {
  private map: L.Map | null = null;
  private readonly aircraftLayer = L.layerGroup();
  private readonly trajectoryLayer = L.layerGroup();
  private readonly areaLayer = L.layerGroup();
  private basemap: BasemapLayer | null = null;
  private sizeObserver: ResizeObserver | null = null;
  private aircraft: MapPosition[] = [];
  private segments: MapPosition[][] = [];
  private area: MapArea | null = null;
  private markerColors: string[] = [];
  private stopSelecting: (() => void) | null = null;

  constructor(private readonly theme: MapTheme = new MapTheme()) {}

  /** Creates the map inside `container`. Call it once, before drawing. */
  mount(container: HTMLElement): void {
    if (this.map) {
      throw new Error("The map is already mounted");
    }
    // The base map is a canvas redrawn on each move, so Leaflet must not animate a zoom by scaling
    // its panes, which would leave the canvas behind. Fractional zooms let the wheel zoom smoothly.
    this.map = L.map(container, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 90,
      maxZoom: 13,
      minZoom: 4,
      maxBounds: MAP_FRAME,
      maxBoundsViscosity: 1,
    });
    this.map.attributionControl.setPrefix(false);
    this.map.attributionControl.addAttribution(ATTRIBUTION);
    this.basemap = new BasemapLayer(this.map, this.theme);
    this.basemap.mount();
    this.areaLayer.addTo(this.map);
    this.aircraftLayer.addTo(this.map);
    this.trajectoryLayer.addTo(this.map);

    // The side bar folding, a rotated phone or a resized window change the room the map has:
    // without this Leaflet keeps drawing for the old size and leaves a blank strip.
    if (typeof ResizeObserver === "function") {
      this.sizeObserver = new ResizeObserver(() => {
        this.map?.invalidateSize();
        this.limitZoomOut();
      });
      this.sizeObserver.observe(container);
    }
  }

  /** Zooming out stops where the map would show more than the base map draws. */
  private limitZoomOut(): void {
    const map = this.map;
    if (!map || map.getSize().x === 0 || map.getSize().y === 0) return;
    map.setMinZoom(map.getBoundsZoom(MAP_FRAME, true));
  }

  /** The Leaflet map, for the layers that draw on it themselves (the traffic of the dashboard). */
  get leaflet(): L.Map {
    return this.requireMap();
  }

  /** The base map layer, which the traffic layer keeps in step with its own frames. */
  get basemapLayer(): BasemapLayer | null {
    return this.basemap;
  }

  /** Outlines the zone of the collection on the base map, or removes it. */
  showZone(zone: Zone): void {
    this.requireMap();
    this.basemap?.setZone(zone);
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

  /** Draws the search area, or removes it when `null`. It does not move the view. */
  showArea(area: MapArea | null): void {
    this.requireMap();
    this.area = area;
    this.drawArea();
  }

  /**
   * Lets the user draw a rectangle by dragging on the map (the map does not pan meanwhile).
   * `onDrawn` receives the area once the mouse is released; a drag too small to enclose
   * anything is ignored. Call `stopAreaSelection` to go back to panning.
   */
  startAreaSelection(onDrawn: (area: MapArea) => void): void {
    const map = this.requireMap();
    this.stopAreaSelection();
    let start: L.LatLng | null = null;
    let box: L.Rectangle | null = null;

    const cancel = () => {
      start = null;
      if (box) this.areaLayer.removeLayer(box);
      box = null;
      map.dragging.enable();
    };
    const onDown = (event: L.LeafletMouseEvent) => {
      start = event.latlng;
      map.dragging.disable();
    };
    const onMove = (event: L.LeafletMouseEvent) => {
      if (!start) return;
      const bounds = L.latLngBounds(start, event.latlng);
      if (box) {
        box.setBounds(bounds);
      } else {
        box = L.rectangle(bounds, this.areaStyle()).addTo(this.areaLayer);
      }
    };
    const onUp = (event: L.LeafletMouseEvent) => {
      if (!start) return;
      const bounds = L.latLngBounds(start, event.latlng);
      cancel();
      const drawn = toArea(bounds);
      if (drawn.south === drawn.north || drawn.west === drawn.east) return;
      this.showArea(drawn);
      onDrawn(drawn);
    };

    map.on("mousedown", onDown).on("mousemove", onMove).on("mouseup", onUp).on("mouseout", cancel);
    map.getContainer().style.cursor = "crosshair";
    this.stopSelecting = () => {
      cancel();
      map.off("mousedown", onDown).off("mousemove", onMove).off("mouseup", onUp).off("mouseout", cancel);
      map.getContainer().style.cursor = "";
    };
  }

  /** Goes back to panning. Safe to call when no selection is going on. */
  stopAreaSelection(): void {
    this.stopSelecting?.();
    this.stopSelecting = null;
  }

  /** Removes the map and frees its resources. Safe to call more than once. */
  destroy(): void {
    this.stopAreaSelection();
    this.sizeObserver?.disconnect();
    this.sizeObserver = null;
    this.basemap?.destroy();
    this.basemap = null;
    this.map?.remove();
    this.map = null;
  }

  get mounted(): boolean {
    return this.map !== null;
  }

  /** Whether a search area is drawn, for tests and accessibility. */
  get hasArea(): boolean {
    return this.areaLayer.getLayers().length > 0;
  }

  /** Number of drawn aircraft markers and trajectory lines, for tests and accessibility. */
  get counts(): { aircraft: number; segments: number } {
    return {
      aircraft: this.aircraftLayer.getLayers().length,
      segments: this.trajectoryLayer.getLayers().length,
    };
  }

  /** Colours of the drawn aircraft markers, for tests. */
  get aircraftColors(): string[] {
    return this.markerColors;
  }

  private drawAircraft(): void {
    const colors = this.theme.colors();
    this.aircraftLayer.clearLayers();
    this.markerColors = [];
    for (const position of this.aircraft) {
      const color = this.theme.markerColor(position, colors);
      this.markerColors.push(color);
      const icon = L.divIcon({
        className: "aircraftMarker",
        html: MarkerIcon.html({
          color: position.onGround ? colors.mid : color,
          outline: colors.outline,
          heading: position.heading,
          onGround: position.onGround,
          alertColor: this.theme.alertColor(position.criticality, colors),
          selectedColor: position.selected ? colors.selected : null,
        }),
        iconSize: [MarkerIcon.SIZE, MarkerIcon.SIZE],
        iconAnchor: [MarkerIcon.SIZE / 2, MarkerIcon.SIZE / 2],
      });
      const marker = L.marker(toLatLng(position), { icon, keyboard: false, title: position.label });
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

  private areaStyle(): L.PathOptions {
    const { selected } = this.theme.colors();
    return { color: selected, weight: 1.5, dashArray: "6 5", fillColor: selected, fillOpacity: 0.12 };
  }

  private drawArea(): void {
    this.areaLayer.clearLayers();
    if (this.area) {
      const { south, west, north, east } = this.area;
      this.areaLayer.addLayer(
        L.rectangle(
          [
            [south, west],
            [north, east],
          ],
          this.areaStyle(),
        ),
      );
    }
  }

  /**
   * Moves the view to show `positions`. Without animation: the aircraft and the trajectory of a
   * flight are drawn one after the other, and Leaflet finishes the first animation after the
   * second move, which would leave the view where the first one was going.
   */
  private fit(map: L.Map, positions: MapPosition[]): void {
    if (positions.length === 1) {
      map.setView(toLatLng(positions[0]), Math.max(map.getZoom(), 10), { animate: false });
    } else if (positions.length > 1) {
      map.fitBounds(L.latLngBounds(positions.map(toLatLng)), { padding: [24, 24], animate: false });
    }
  }

  private requireMap(): L.Map {
    if (!this.map) {
      throw new Error("The map is not mounted");
    }
    return this.map;
  }
}

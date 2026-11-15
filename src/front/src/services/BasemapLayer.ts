import type L from "leaflet";

import { Basemap, type Zone } from "@/services/Basemap";
import { type MapColors, MapTheme } from "@/services/MapTheme";
import type { MapView } from "@/services/Mercator";

/**
 * Puts the drawn base map behind a Leaflet map. It is a canvas under the panes of Leaflet, drawn
 * again when the view moves, zooms or changes size: at most once per frame, so a drag stays smooth.
 * Without a 2D context (a test) it draws nothing.
 */
export class BasemapLayer {
  private readonly canvas = document.createElement("canvas");
  private basemap: Basemap | null = null;
  private readonly colors: MapColors;
  private zone: Zone = null;
  private frame = 0;
  private destroyed = false;

  constructor(
    private readonly map: L.Map,
    theme: MapTheme = new MapTheme(),
    private readonly loader: () => Promise<Basemap> = () => Basemap.load(),
  ) {
    this.colors = theme.colors();
  }

  /** Whether the files are loaded and the map can be drawn. */
  get ready(): boolean {
    return this.basemap !== null;
  }

  mount(): void {
    const { style } = this.canvas;
    style.position = "absolute";
    style.inset = "0";
    style.width = "100%";
    style.height = "100%";
    style.pointerEvents = "none";
    this.canvas.setAttribute("aria-hidden", "true");
    this.map.getContainer().prepend(this.canvas);
    this.map.on("move zoom resize viewreset", this.schedule);
    void this.loader().then((basemap) => {
      if (this.destroyed) return;
      this.basemap = basemap;
      this.schedule();
    });
  }

  /** The zone of the collection to outline, or none. */
  setZone(zone: Zone): void {
    this.zone = zone;
    this.schedule();
  }

  /** Draws now what is waiting to be drawn, so a layer drawn in the same frame is in step with the map. */
  flush(): void {
    if (this.frame === 0) return;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.draw();
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    this.map.off("move zoom resize viewreset", this.schedule);
    this.canvas.remove();
  }

  private readonly schedule = (): void => {
    if (this.destroyed || this.frame !== 0) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  };

  private draw(): void {
    const { basemap } = this;
    if (!basemap || this.destroyed) return;
    const context = this.canvas.getContext("2d");
    if (!context) return;
    const size = this.map.getSize();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(size.x * ratio);
    const height = Math.round(size.y * ratio);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const center = this.map.getCenter();
    const view: MapView = { lat: center.lat, lon: center.lng, zoom: this.map.getZoom(), width: size.x, height: size.y };
    basemap.draw(context, view, this.colors, this.zone);
  }
}

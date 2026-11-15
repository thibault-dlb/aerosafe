import type L from "leaflet";

import type { FlightPoint, TrackedSnapshot, TrafficAircraft } from "@/models/Traffic";
import type { BasemapLayer } from "@/services/BasemapLayer";
import { DeadReckoning, type Motion } from "@/services/DeadReckoning";
import { type MapColors, MapTheme } from "@/services/MapTheme";
import { type MapView, Mercator } from "@/services/Mercator";
import { type SpriteSet, TrafficSprites } from "@/services/TrafficSprites";

/** One aircraft on the map: its latest report, how it moves from there, and where the last frame drew it. */
interface Mover {
  data: TrafficAircraft;
  motion: Motion;
  /** What is left of the jump to the new report, in the unit square; it fades out in `SETTLE_MS`. */
  shiftX: number;
  shiftY: number;
  shiftAt: number;
  color: string;
  alertColor: string | null;
  /** The heading as a step of the sprites. */
  step: number;
  /** Screen position of the last frame. */
  x: number;
  y: number;
  /** World position and age of the last frame. */
  wx: number;
  wy: number;
  age: number;
  silent: boolean;
  visible: boolean;
}

export interface TrafficLayerOptions {
  /** A click on an aircraft gives its id, a click on nothing gives null. */
  onPick?: (id: string | null) => void;
  /** The user moved the map by hand: the following of an aircraft stops. */
  onUserMove?: () => void;
  /** Without motion the aircraft are replaced at each report and nothing pulses. */
  reducedMotion?: boolean;
}

const FONT = '10px "JetBrains Mono Variable", "JetBrains Mono", ui-monospace, Consolas, monospace';

/**
 * Draws the traffic on a Leaflet map: every aircraft, turned along its heading, a line in front of it
 * for the next 15 minutes, the echo of an alert, and for the aircraft that is followed its whole flight
 * behind it. It runs its own loop, so the aircraft glide between two reports from the API: each one
 * is carried forward from its last report by `DeadReckoning`, and takes a new report in a second, not
 * in a jump. The aircraft are copies of small sprites, and the lines are drawn in one stroke for
 * each colour, which keeps a few thousand aircraft smooth.
 */
export class TrafficLayer {
  /** A new report is blended in over this time, in milliseconds. */
  static readonly SETTLE_MS = 1000;
  /** The click that picks an aircraft reaches this far, in pixels. */
  static readonly PICK_RADIUS = 14;

  private readonly canvas = document.createElement("canvas");
  private readonly sprites = new TrafficSprites();
  private readonly movers = new Map<string, Mover>();
  private readonly lines = new Map<string, number[]>();
  private colors: MapColors;
  private trackedId: string | null = null;
  private following = false;
  private trail: Float64Array = new Float64Array(0);
  private frame = 0;
  private lastFrame = 0;
  private destroyed = false;
  private readonly reduced: boolean;

  constructor(
    private readonly map: L.Map,
    private readonly clock: () => number,
    private readonly theme: MapTheme = new MapTheme(),
    private readonly options: TrafficLayerOptions = {},
    private readonly basemap: BasemapLayer | null = null,
  ) {
    this.colors = theme.colors();
    this.reduced =
      options.reducedMotion ?? (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  /** Number of aircraft on the map. */
  get count(): number {
    return this.movers.size;
  }

  mount(): void {
    const { style } = this.canvas;
    style.position = "absolute";
    style.inset = "0";
    style.width = "100%";
    style.height = "100%";
    style.pointerEvents = "none";
    // Above the panes of Leaflet (400), under its controls and the panels over the map.
    style.zIndex = "450";
    this.canvas.setAttribute("aria-hidden", "true");
    this.map.getContainer().appendChild(this.canvas);
    this.map.on("click", this.onClick);
    this.map.on("dragstart", this.onDragStart);
    this.frame = requestAnimationFrame(this.loop);
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    this.map.off("click", this.onClick);
    this.map.off("dragstart", this.onDragStart);
    this.canvas.remove();
    this.movers.clear();
  }

  /** The colours of the theme in use. */
  setColors(colors: MapColors): void {
    this.colors = colors;
    for (const mover of this.movers.values()) this.paint(mover);
  }

  /**
   * Takes the latest reports. An aircraft already on the map is not moved at once to its new place:
   * the gap between where it was drawn and where the report puts it fades out in a second.
   */
  update(aircraft: TrafficAircraft[], real: number = performance.now()): void {
    const now = this.clock();
    const seen = new Set<string>();
    for (const data of aircraft) {
      seen.add(data.id);
      const motion = DeadReckoning.motion(data.lat, data.lon, data.heading, data.speed, data.onGround, data.contactAt ?? now);
      const known = this.movers.get(data.id);
      if (known) {
        const before = this.estimate(known, now, real);
        const after = DeadReckoning.at(motion, now);
        known.shiftX = before.x - after.x;
        known.shiftY = before.y - after.y;
        known.shiftAt = real;
        known.data = data;
        known.motion = motion;
        this.paint(known);
      } else {
        const mover: Mover = {
          data,
          motion,
          shiftX: 0,
          shiftY: 0,
          shiftAt: real,
          color: "",
          alertColor: null,
          step: 0,
          x: 0,
          y: 0,
          wx: 0,
          wy: 0,
          age: 0,
          silent: false,
          visible: false,
        };
        this.paint(mover);
        this.movers.set(data.id, mover);
      }
    }
    for (const id of this.movers.keys()) {
      // The aircraft that is followed stays, where it was last heard, even if the API no longer lists it.
      if (!seen.has(id) && id !== this.trackedId) this.movers.delete(id);
    }
  }

  /** Follows an aircraft: a ring around it, its whole flight behind it, a card. Null stops following. */
  track(id: string | null): void {
    this.trackedId = id;
    if (id === null) {
      this.following = false;
      this.trail = new Float64Array(0);
    }
  }

  /** While true, the map keeps the followed aircraft at its centre. */
  follow(following: boolean): void {
    this.following = following && this.trackedId !== null;
  }

  /** Everything known of the flight of the followed aircraft, to draw behind it. */
  setTrail(points: FlightPoint[]): void {
    const trail = new Float64Array(points.length * 2);
    points.forEach((point, index) => {
      trail[index * 2] = Mercator.x(point.lon);
      trail[index * 2 + 1] = Mercator.y(point.lat);
    });
    this.trail = trail;
  }

  /** What the card of the followed aircraft shows, or null if it is not on the map. */
  describe(id: string, real: number = performance.now()): TrackedSnapshot | null {
    const mover = this.movers.get(id);
    if (!mover) return null;
    const estimate = this.estimate(mover, this.clock(), real);
    const { data } = mover;
    return {
      id,
      lat: Mercator.lat(estimate.y),
      lon: Mercator.lon(estimate.x),
      altitude: data.altitude,
      heading: data.heading,
      speed: data.speed,
      onGround: data.onGround,
      age: estimate.age,
      silent: estimate.silent,
    };
  }

  /** The aircraft nearest to a pixel, within `PICK_RADIUS`, as drawn by the last frame. */
  pick(x: number, y: number): string | null {
    let best: string | null = null;
    let nearest = TrafficLayer.PICK_RADIUS;
    for (const [id, mover] of this.movers) {
      if (!mover.visible) continue;
      const distance = Math.hypot(mover.x - x, mover.y - y);
      if (distance < nearest) {
        nearest = distance;
        best = id;
      }
    }
    return best;
  }

  /** Draws one frame in `context`. The loop calls it; tests call it with a context of their own. */
  render(context: CanvasRenderingContext2D, view: MapView, ratio: number, real: number = performance.now()): void {
    const now = this.clock();
    const scale = Mercator.scale(view.zoom);
    const originX = Mercator.x(view.lon);
    const originY = Mercator.y(view.lat);
    const planeScale = TrafficSprites.scale(view.zoom);
    const tracked = this.trackedId ? this.movers.get(this.trackedId) : undefined;
    const { colors } = this;

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, view.width, view.height);

    // Where every aircraft is, and the line in front of the ones that fly.
    for (const line of this.lines.values()) line.length = 0;
    const horizon = DeadReckoning.HORIZON_MS;
    for (const mover of this.movers.values()) {
      const estimate = this.estimate(mover, now, real);
      mover.wx = estimate.x;
      mover.wy = estimate.y;
      mover.age = estimate.age;
      mover.silent = estimate.silent;
      mover.x = (estimate.x - originX) * scale + view.width / 2;
      mover.y = (estimate.y - originY) * scale + view.height / 2;
      const { motion } = mover;
      const endX = mover.x + motion.vx * horizon * scale;
      const endY = mover.y + motion.vy * horizon * scale;
      mover.visible = Math.max(mover.x, endX) > -20 && Math.min(mover.x, endX) < view.width + 20 && Math.max(mover.y, endY) > -20 && Math.min(mover.y, endY) < view.height + 20;
      if (!mover.visible || mover === tracked || mover.silent || !DeadReckoning.moving(motion)) continue;
      let line = this.lines.get(mover.color);
      if (!line) {
        line = [];
        this.lines.set(mover.color, line);
      }
      line.push(mover.x, mover.y, endX, endY);
    }
    const opacity = Math.max(0.13, Math.min(0.34, 0.13 + (view.zoom - 6) * 0.08));
    context.lineWidth = 1;
    for (const [color, line] of this.lines) {
      if (line.length === 0) continue;
      context.strokeStyle = color;
      context.globalAlpha = opacity;
      context.beginPath();
      for (let index = 0; index < line.length; index += 4) {
        context.moveTo(line[index], line[index + 1]);
        context.lineTo(line[index + 2], line[index + 3]);
      }
      context.stroke();
    }
    context.globalAlpha = 1;

    if (tracked) this.drawTrackedPath(context, tracked, view, scale, originX, originY);

    // The aircraft: a sprite for each one that flies, a diamond for each one on the ground.
    context.strokeStyle = colors.mid;
    context.lineWidth = 1.5;
    context.beginPath();
    for (const mover of this.movers.values()) {
      if (!mover.visible || mover.data.onGround !== true) continue;
      context.moveTo(mover.x, mover.y - 5);
      context.lineTo(mover.x + 5, mover.y);
      context.lineTo(mover.x, mover.y + 5);
      context.lineTo(mover.x - 5, mover.y);
      context.closePath();
    }
    context.stroke();
    const sets = new Map<string, SpriteSet>();
    for (const mover of this.movers.values()) {
      if (!mover.visible || mover.data.onGround === true) continue;
      let set = sets.get(mover.color);
      if (!set) {
        set = this.sprites.set(mover.color, colors.outline, planeScale, ratio);
        sets.set(mover.color, set);
      }
      const sprite = set.get(mover.step);
      if (!sprite) continue;
      context.globalAlpha = mover.silent ? 0.4 : 1;
      context.drawImage(sprite.image, mover.x - sprite.box / 2, mover.y - sprite.box / 2, sprite.box, sprite.box);
    }
    context.globalAlpha = 1;

    // The echo of the alerts, the ring and the name of the aircraft that is followed.
    const pulse = this.reduced ? 0 : (real % 2200) / 2200;
    for (const mover of this.movers.values()) {
      if (!mover.visible || mover.alertColor === null) continue;
      context.globalAlpha = mover.silent ? 0.4 : 1;
      context.strokeStyle = mover.alertColor;
      context.lineWidth = 1.3;
      context.beginPath();
      context.arc(mover.x, mover.y, 11, 0, Math.PI * 2);
      context.stroke();
      if (!this.reduced) {
        context.globalAlpha = (mover.silent ? 0.4 : 1) * (1 - pulse);
        context.beginPath();
        context.arc(mover.x, mover.y, 8 + pulse * 16, 0, Math.PI * 2);
        context.stroke();
      }
    }
    context.globalAlpha = 1;
    context.font = FONT;
    if (view.zoom > 8.6) {
      context.fillStyle = colors.text;
      context.globalAlpha = 0.85;
      let labels = 0;
      for (const mover of this.movers.values()) {
        if (!mover.visible || mover === tracked || mover.data.onGround === true || labels >= 150) continue;
        context.fillText(mover.data.name, mover.x + 14, mover.y - 8);
        labels += 1;
      }
      context.globalAlpha = 1;
    }
    if (tracked) {
      context.strokeStyle = colors.selected;
      context.lineWidth = 1.6;
      context.setLineDash([3, 3]);
      context.beginPath();
      context.arc(tracked.x, tracked.y, 17, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = colors.selected;
      context.fillText(tracked.data.name, tracked.x + 22, tracked.y - 12);
    }
  }

  /** The whole flight behind the followed aircraft, dotted, and the line of its next 15 minutes with marks. */
  private drawTrackedPath(context: CanvasRenderingContext2D, tracked: Mover, view: MapView, scale: number, originX: number, originY: number): void {
    const { colors } = this;
    context.strokeStyle = colors.selected;
    if (this.trail.length >= 4) {
      context.lineWidth = 2;
      context.globalAlpha = 0.75;
      context.lineCap = "round";
      context.setLineDash([1, 5]);
      context.beginPath();
      let lastX = Number.NaN;
      let lastY = Number.NaN;
      const last = this.trail.length / 2 - 1;
      for (let index = 0; index <= last; index++) {
        const x = (this.trail[index * 2] - originX) * scale + view.width / 2;
        const y = (this.trail[index * 2 + 1] - originY) * scale + view.height / 2;
        if (index > 0 && index < last && Math.abs(x - lastX) < 1.5 && Math.abs(y - lastY) < 1.5) continue;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
        lastX = x;
        lastY = y;
      }
      context.lineTo(tracked.x, tracked.y);
      context.stroke();
      context.setLineDash([]);
      context.lineCap = "butt";
    }
    const { motion } = tracked;
    if (tracked.silent || !DeadReckoning.moving(motion)) {
      context.globalAlpha = 1;
      return;
    }
    const endX = tracked.x + motion.vx * DeadReckoning.HORIZON_MS * scale;
    const endY = tracked.y + motion.vy * DeadReckoning.HORIZON_MS * scale;
    context.globalAlpha = 0.95;
    context.lineWidth = 1.8;
    context.beginPath();
    context.moveTo(tracked.x, tracked.y);
    context.lineTo(endX, endY);
    const length = Math.hypot(endX - tracked.x, endY - tracked.y);
    if (length > 45) {
      const normalX = (-(endY - tracked.y) / length) * 3.5;
      const normalY = ((endX - tracked.x) / length) * 3.5;
      for (const part of [1 / 3, 2 / 3, 1]) {
        const x = tracked.x + (endX - tracked.x) * part;
        const y = tracked.y + (endY - tracked.y) * part;
        context.moveTo(x - normalX, y - normalY);
        context.lineTo(x + normalX, y + normalY);
      }
    }
    context.stroke();
    context.globalAlpha = 1;
  }

  /** The place of an aircraft in the unit square: carried from its report, plus the fading gap to the last one. */
  private estimate(mover: Mover, now: number, real: number) {
    const estimate = DeadReckoning.at(mover.motion, now);
    const left = this.reduced ? 0 : Math.max(0, 1 - (real - mover.shiftAt) / TrafficLayer.SETTLE_MS);
    const fade = left * left;
    return { ...estimate, x: estimate.x + mover.shiftX * fade, y: estimate.y + mover.shiftY * fade };
  }

  private paint(mover: Mover): void {
    mover.color = this.theme.markerColor({ altitude: mover.data.altitude, criticality: mover.data.criticality }, this.colors);
    mover.alertColor = this.theme.alertColor(mover.data.criticality, this.colors);
    mover.step = TrafficSprites.step(mover.data.heading);
  }

  private readonly onClick = (event: L.LeafletMouseEvent): void => {
    this.options.onPick?.(this.pick(event.containerPoint.x, event.containerPoint.y));
  };

  private readonly onDragStart = (): void => {
    this.following = false;
    this.options.onUserMove?.();
  };

  private readonly loop = (real: number): void => {
    if (this.destroyed) return;
    this.frame = requestAnimationFrame(this.loop);
    // Many aircraft are drawn at 30 frames per second: the eye does not see the difference, the processor does.
    if (real - this.lastFrame < (this.movers.size > 400 ? 30 : 15)) return;
    this.lastFrame = real;
    this.draw(real);
  };

  private draw(real: number): void {
    const context = this.canvas.getContext("2d");
    if (!context) return;
    const tracked = this.trackedId ? this.movers.get(this.trackedId) : undefined;
    if (this.following && tracked) {
      const estimate = this.estimate(tracked, this.clock(), real);
      const center = this.map.getCenter();
      const size = this.map.getSize();
      const scale = Mercator.scale(this.map.getZoom());
      const gap = Math.hypot((estimate.x - Mercator.x(center.lng)) * scale, (estimate.y - Mercator.y(center.lat)) * scale);
      if (gap > 0.3 && size.x > 0) {
        this.map.setView([Mercator.lat(estimate.y), Mercator.lon(estimate.x)], this.map.getZoom(), { animate: false });
      }
    }
    // The base map is drawn first, in the same frame, so it never lags behind the aircraft.
    this.basemap?.flush();
    const size = this.map.getSize();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(size.x * ratio);
    const height = Math.round(size.y * ratio);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    const center = this.map.getCenter();
    this.render(context, { lat: center.lat, lon: center.lng, zoom: this.map.getZoom(), width: size.x, height: size.y }, ratio, real);
  }
}

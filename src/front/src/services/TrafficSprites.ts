import { AIRCRAFT_SILHOUETTE } from "@/components/ui/IconSet";

/** A drawn silhouette and its width in CSS pixels, so a frame can centre it. */
export interface Sprite {
  image: HTMLCanvasElement;
  box: number;
}

/**
 * The silhouettes of the aircraft, drawn once for each colour, size and heading (in steps of five
 * degrees) into small canvases. A frame then only copies them, which is what lets the map move
 * thousands of aircraft without a stutter: drawing a path for each one costs far more.
 */
export class TrafficSprites {
  /** The heading is rounded to this many degrees. */
  static readonly STEP = 5;
  /** Half the width of the silhouette, in its own units. */
  static readonly EXTENT = 14;

  private readonly cache = new Map<string, Sprite>();
  private path: Path2D | null = null;

  constructor(private readonly create: () => HTMLCanvasElement = () => document.createElement("canvas")) {}

  /** The heading as a step number. */
  static step(heading: number | null): number {
    if (heading === null || !Number.isFinite(heading)) return 0;
    const steps = 360 / TrafficSprites.STEP;
    return ((Math.round(heading / TrafficSprites.STEP) % steps) + steps) % steps;
  }

  /** The size of the silhouette for a zoom, in steps of 0.05 so the cache stays small. */
  static scale(zoom: number): number {
    const raw = Math.max(0.34, Math.min(0.85, 0.42 + (zoom - 5.5) * 0.12));
    return Math.round(raw * 20) / 20;
  }

  get size(): number {
    return this.cache.size;
  }

  /** The sprite of an aircraft, or null where there is no canvas (a test). Its centre is the aircraft. */
  plane(color: string, outline: string, heading: number | null, scale: number, ratio: number): Sprite | null {
    const step = TrafficSprites.step(heading);
    const key = `${color}|${outline}|${step}|${scale}|${ratio}`;
    const known = this.cache.get(key);
    if (known) return known;
    const canvas = this.create();
    const box = Math.ceil(TrafficSprites.EXTENT * 2 * scale + 4);
    canvas.width = Math.ceil(box * ratio);
    canvas.height = Math.ceil(box * ratio);
    const context = canvas.getContext("2d");
    if (!context) return null;
    this.path ??= new Path2D(AIRCRAFT_SILHOUETTE);
    context.scale(ratio, ratio);
    context.translate(box / 2, box / 2);
    context.rotate((step * TrafficSprites.STEP * Math.PI) / 180);
    context.scale(scale, scale);
    context.lineJoin = "round";
    context.lineWidth = 2.2;
    context.strokeStyle = outline;
    context.stroke(this.path);
    context.fillStyle = color;
    context.fill(this.path);
    const sprite = { image: canvas, box };
    this.cache.set(key, sprite);
    return sprite;
  }
}

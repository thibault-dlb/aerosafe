/** One drawn element of an icon, on a 24 by 24 grid. `solid` shapes are filled instead of outlined. */
export type IconShape =
  | { tag: "path"; d: string; transform?: string; dash?: string }
  | { tag: "circle"; cx: number; cy: number; r: number; solid?: boolean }
  | { tag: "rect"; x: number; y: number; width: number; height: number; rx: number; dash?: string };

export type IconName =
  | "dashboard"
  | "aircraft"
  | "alert"
  | "rules"
  | "accounts"
  | "user"
  | "logout"
  | "mail"
  | "lock"
  | "eye"
  | "eyeOff"
  | "capsLock"
  | "info"
  | "check"
  | "close"
  | "menu"
  | "chevron"
  | "collapse"
  | "expand"
  | "search"
  | "sun"
  | "moon"
  | "live"
  | "replay"
  | "radar"
  | "ruleR1"
  | "ruleR2"
  | "ruleR3"
  | "ruleR4"
  | "ruleR5"
  | "filter"
  | "plus"
  | "copy"
  | "trash"
  | "pause"
  | "play"
  | "bolt"
  | "area"
  | "key"
  | "ruler"
  | "clock"
  | "shield"
  | "anonymous"
  | "table";

const path = (d: string, transform?: string, dash?: string): IconShape => ({ tag: "path", d, transform, dash });
const circle = (cx: number, cy: number, r: number, solid = false): IconShape => ({ tag: "circle", cx, cy, r, solid });
const rect = (x: number, y: number, width: number, height: number, rx: number, dash?: string): IconShape => ({
  tag: "rect",
  x,
  y,
  width,
  height,
  rx,
  dash,
});

/** The silhouette of the aircraft of the landing page scene, nose to the north. */
export const AIRCRAFT_SILHOUETTE =
  "M0 -13L2.6 -4.5L12 2.5L12 5L2.6 2.2L2 8.5L5.2 11L5.2 12.6L0 11.4L-5.2 12.6L-5.2 11L-2 8.5L-2.6 2.2L-12 5L-12 2.5L-2.6 -4.5Z";

/**
 * The icons of the interface: thin outlines with round ends, the same drawing as the logo.
 * An icon takes the colour of the text around it.
 */
export class IconSet {
  private static readonly SHAPES: Record<IconName, IconShape[]> = {
    dashboard: [rect(3.5, 3.5, 7, 9, 1.5), rect(13.5, 3.5, 7, 5, 1.5), rect(13.5, 11.5, 7, 9, 1.5), rect(3.5, 15.5, 7, 5, 1.5)],
    aircraft: [path(AIRCRAFT_SILHOUETTE, "translate(12 12.2) scale(.74)")],
    alert: [path("M12 3.8 21.2 19.6H2.8Z"), path("M12 10v4.4"), circle(12, 17, 0.9, true)],
    rules: [
      path("M4 6h8.5M17.5 6H20M4 12h2.5M11.5 12H20M4 18h10.5M19.5 18h.5"),
      circle(15, 6, 2.2),
      circle(9, 12, 2.2),
      circle(17, 18, 2.2),
    ],
    accounts: [
      circle(9, 8.2, 3.3),
      path("M2.8 19.8c0-3.5 2.7-6 6.2-6s6.2 2.5 6.2 6"),
      path("M15.6 5.3a3 3 0 0 1 0 5.8M17.8 14.4c2 .7 3.4 2.6 3.4 5.4"),
    ],
    user: [circle(12, 8, 3.6), path("M4.8 20c0-3.9 3.1-6.6 7.2-6.6s7.2 2.7 7.2 6.6")],
    logout: [
      path("M13.5 4H6.5a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6.5 20h7"),
      path("M10 12h10.5M17 8l4 4-4 4"),
    ],
    mail: [rect(3, 5, 18, 14, 2), path("m3.6 7.2 8.4 6 8.4-6")],
    lock: [rect(5, 10.5, 14, 10, 2), path("M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5"), path("M12 14.6v2")],
    eye: [path("M2.5 12S6 5.6 12 5.6 21.5 12 21.5 12 18 18.4 12 18.4 2.5 12 2.5 12Z"), circle(12, 12, 2.9)],
    eyeOff: [
      path(
        "M6.2 7.7C3.8 9.5 2.5 12 2.5 12S6 18.4 12 18.4c1.6 0 3-.4 4.3-1.1M9.6 5.9c.8-.2 1.6-.3 2.4-.3 6 0 9.5 6.4 9.5 6.4s-.8 1.5-2.3 3.1",
      ),
      path("M9.9 9.9a2.9 2.9 0 0 0 4.1 4.1"),
      path("M4 4l16 16"),
    ],
    capsLock: [path("M12 3.8 19.5 12h-4v4.2h-7V12h-4Z"), path("M8.5 19.7h7")],
    info: [circle(12, 12, 8.7), path("M12 11v5.2"), circle(12, 7.9, 0.9, true)],
    check: [path("m5 12.6 4.5 4.5L19 7.4")],
    close: [path("M6 6l12 12M18 6 6 18")],
    menu: [path("M4 6.5h16M4 12h16M4 17.5h16")],
    chevron: [path("m9 5.5 6.5 6.5L9 18.5")],
    collapse: [path("m11.5 6-6 6 6 6M18.5 6l-6 6 6 6")],
    expand: [path("m12.5 6 6 6-6 6M5.5 6l6 6-6 6")],
    search: [circle(11, 11, 6.5), path("m16 16 4.5 4.5")],
    sun: [
      circle(12, 12, 3.8),
      path("M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"),
    ],
    moon: [path("M20.3 14.6A8.6 8.6 0 1 1 9.4 3.7a7 7 0 0 0 10.9 10.9Z")],
    live: [
      circle(12, 12, 2, true),
      path("M8.3 8.3a5.2 5.2 0 0 0 0 7.4M15.7 8.3a5.2 5.2 0 0 1 0 7.4M5.3 5.3a9.5 9.5 0 0 0 0 13.4M18.7 5.3a9.5 9.5 0 0 1 0 13.4"),
    ],
    replay: [path("M4.2 13.5a8 8 0 1 0 1.9-6.7"), path("M4 3.8v4.7h4.7"), path("M12 8.3v4.2l2.9 1.7")],
    radar: [circle(12, 12, 8.7), circle(12, 12, 4.3), path("M12 12 18.1 5.9"), circle(16.3, 14.8, 1, true)],
    // R1, contact lost: the signal of the transmitter, struck through.
    ruleR1: [
      circle(12, 12, 1.8, true),
      path("M8.3 8.3a5.2 5.2 0 0 0 0 7.4M15.7 8.3a5.2 5.2 0 0 1 0 7.4M5.3 5.3a9.5 9.5 0 0 0 0 13.4M18.7 5.3a9.5 9.5 0 0 1 0 13.4"),
      path("M3.5 20.5l17-17"),
    ],
    // R2, position too old: a map pin with a clock.
    ruleR2: [path("M12 21.2s-6.8-6.2-6.8-11.4a6.8 6.8 0 0 1 13.6 0c0 5.2-6.8 11.4-6.8 11.4Z"), path("M12 6.6v3.6l2.3 1.4")],
    // R3, altitude change: a vertical arrow both ways.
    ruleR3: [path("M12 3.5v17M8.5 7 12 3.5 15.5 7M8.5 17l3.5 3.5 3.5-3.5"), path("M3.5 12H8M16 12h4.5")],
    // R4, speed change: a gauge.
    ruleR4: [path("M4.2 17.5a8.6 8.6 0 1 1 15.6 0"), path("M12 14.5l4.2-6"), circle(12, 14.8, 1.4, true), path("M7 20.5h10")],
    // R5, heading change: a turning arrow.
    ruleR5: [path("M5.5 20.5v-8a6 6 0 0 1 6-6h8"), path("M16 3l3.5 3.5L16 10"), path("M5.5 8V3.2", undefined, "1.6 2.6")],
    filter: [path("M3.5 5h17l-6.5 8v5.5l-4 2V13Z")],
    plus: [path("M12 5v14M5 12h14")],
    copy: [rect(8.5, 8.5, 12, 12, 2), path("M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3")],
    trash: [
      path("M4 6.5h16M9.5 6.5V4h5v2.5M6.5 6.5l.8 13a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-13M10 10.5V17M14 10.5V17"),
    ],
    pause: [path("M8.5 5v14M15.5 5v14")],
    play: [path("M7.5 4.8v14.4L19 12Z")],
    bolt: [path("M13 2.8 5 13.5h6l-1 7.7 8-10.7h-6Z")],
    area: [rect(4, 5.5, 16, 13, 1, "3 3"), circle(4, 5.5, 1.4, true), circle(20, 18.5, 1.4, true)],
    key: [circle(8, 15, 4.2), path("M11 12l8.5-8.5M16 7l3 3M13.5 9.5l2 2")],
    ruler: [rect(2.5, 8, 19, 8, 1.5), path("M6.5 8v3M10.2 8v4.5M13.9 8v3M17.6 8v4.5")],
    clock: [circle(12, 12, 8.7), path("M12 7v5.2l3.4 2")],
    shield: [path("M12 3 4.5 6v5.5c0 4.6 3.1 8 7.5 9.5 4.4-1.5 7.5-4.9 7.5-9.5V6Z")],
    anonymous: [circle(12, 8, 3.6), path("M4.8 20c0-3.9 3.1-6.6 7.2-6.6 1.2 0 2.3.2 3.3.6M4 4l16 16")],
    table: [rect(3.5, 4.5, 17, 15, 1.5), path("M3.5 9.5h17M3.5 14.5h17M9.5 4.5v15")],
  };

  static names(): IconName[] {
    return Object.keys(IconSet.SHAPES) as IconName[];
  }

  static shapes(name: IconName): readonly IconShape[] {
    return IconSet.SHAPES[name];
  }
}

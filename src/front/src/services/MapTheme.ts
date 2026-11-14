import type { Criticality } from "@/models/Alert";

/** The colours the map draws with. */
export interface MapColors {
  /** Aircraft below FL150. */
  low: string;
  /** Aircraft between FL150 and FL300. */
  mid: string;
  /** Aircraft above FL300. */
  high: string;
  /** Selected aircraft and trajectory. */
  selected: string;
  /** Outline of the markers, the colour of the map background. */
  outline: string;
  /** Aircraft with an active alert of high criticality. */
  alertHigh: string;
  /** Aircraft with an active alert of medium criticality. */
  alertMedium: string;
  /** Aircraft with an active alert of low criticality. */
  alertLow: string;
}

/** What decides the colour of a marker: its altitude, or the alert it carries. */
export interface MarkerShade {
  altitude?: number | null;
  criticality?: Criticality | null;
}

/**
 * Reads the map colours from the tokens of the current theme (`styles/tokens.css`), so the map
 * follows the dark and light themes. Altitude is read from the shade (brand guidelines,
 * section 2.E); an alert takes the colour of its criticality, the same as everywhere else.
 */
export class MapTheme {
  /** FL150 and FL300 in metres (1 FL = 100 ft = 30.48 m). */
  static readonly LOW_LIMIT = 4572;
  static readonly HIGH_LIMIT = 9144;

  /** Dark theme values, used only where the style sheet is not loaded (unit tests). */
  static readonly FALLBACK: MapColors = {
    low: "#b07a1c",
    mid: "#e3b23c",
    high: "#f5d77e",
    selected: "#3dd6c4",
    outline: "#130e04",
    alertHigh: "#e5604d",
    alertMedium: "#f28c28",
    alertLow: "#e3b23c",
  };

  private static readonly TOKENS: Record<keyof MapColors, string> = {
    low: "--map-aircraft-low",
    mid: "--map-aircraft-mid",
    high: "--map-aircraft-high",
    selected: "--map-selected",
    outline: "--map-bg",
    alertHigh: "--color-danger",
    alertMedium: "--color-warning",
    alertLow: "--color-brand",
  };

  constructor(private readonly root: HTMLElement = document.documentElement) {}

  /** The colours of the theme in use. */
  colors(): MapColors {
    const style = getComputedStyle(this.root);
    const read = (key: keyof MapColors): string =>
      style.getPropertyValue(MapTheme.TOKENS[key]).trim() || MapTheme.FALLBACK[key];
    return {
      low: read("low"),
      mid: read("mid"),
      high: read("high"),
      selected: read("selected"),
      outline: read("outline"),
      alertHigh: read("alertHigh"),
      alertMedium: read("alertMedium"),
      alertLow: read("alertLow"),
    };
  }

  /** The colour of an aircraft at `altitude` metres. Without an altitude, the middle shade. */
  aircraftColor(altitude: number | null | undefined, colors: MapColors = this.colors()): string {
    if (altitude === null || altitude === undefined) {
      return colors.mid;
    }
    if (altitude < MapTheme.LOW_LIMIT) {
      return colors.low;
    }
    return altitude > MapTheme.HIGH_LIMIT ? colors.high : colors.mid;
  }

  /** The colour of the alert of an aircraft, or `null` when it has none. */
  alertColor(criticality: Criticality | null | undefined, colors: MapColors = this.colors()): string | null {
    switch (criticality) {
      case "HIGH":
        return colors.alertHigh;
      case "MEDIUM":
        return colors.alertMedium;
      case "LOW":
        return colors.alertLow;
      default:
        return null;
    }
  }

  /** The colour of a marker: the alert when there is one, otherwise the shade of the altitude. */
  markerColor(shade: MarkerShade, colors: MapColors = this.colors()): string {
    return this.alertColor(shade.criticality, colors) ?? this.aircraftColor(shade.altitude, colors);
  }
}

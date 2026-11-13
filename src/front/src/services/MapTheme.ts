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
}

/**
 * Reads the map colours from the `--map-*` tokens of the current theme (`styles/tokens.css`),
 * so the map follows the dark and light themes. Altitude is read from the shade (brand
 * guidelines, section 2.E).
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
  };

  private static readonly TOKENS: Record<keyof MapColors, string> = {
    low: "--map-aircraft-low",
    mid: "--map-aircraft-mid",
    high: "--map-aircraft-high",
    selected: "--map-selected",
  };

  constructor(private readonly root: HTMLElement = document.documentElement) {}

  /** The colours of the theme in use. */
  colors(): MapColors {
    const style = getComputedStyle(this.root);
    const read = (key: keyof MapColors): string =>
      style.getPropertyValue(MapTheme.TOKENS[key]).trim() || MapTheme.FALLBACK[key];
    return { low: read("low"), mid: read("mid"), high: read("high"), selected: read("selected") };
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
}

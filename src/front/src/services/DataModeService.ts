import { PreferenceStore } from "@/services/PreferenceStore";

/**
 * Which data the application shows: one of the two live collections, OpenSky or adsb.fi, collected in
 * parallel, or the replay of historical traffic. The value is the one the API takes in `source`.
 */
export type DataMode = "opensky" | "adsbfi" | "replay";

export const DATA_MODES: readonly DataMode[] = ["opensky", "adsbfi", "replay"];

/**
 * The data mode chosen by the user, and the way it reaches the API: the requests that read aircraft,
 * flights, alerts and the dashboard carry `source=<mode>`.
 *
 * The choice is remembered like the language and the units. It is also kept in memory, shared by
 * every instance, so the services that call the API follow it even when the browser storage is
 * blocked and nothing can be remembered. A value stored before the two live sources existed (`live`)
 * is not a mode any more: the default is shown instead.
 */
export class DataModeService {
  static readonly KEY = "aerosafe.mode";
  /** adsb.fi by default: refreshed every 5 s, over 250 NM, and fresher than OpenSky. */
  static readonly DEFAULT: DataMode = "adsbfi";

  private static remembered: DataMode | null = null;

  constructor(private readonly store: PreferenceStore = new PreferenceStore()) {}

  static isMode(value: string | null): value is DataMode {
    return (DATA_MODES as readonly (string | null)[]).includes(value);
  }

  /** Forgets the choice kept in memory. Tests call it between two cases. */
  static reset(): void {
    DataModeService.remembered = null;
  }

  current(): DataMode {
    const stored = this.store.get(DataModeService.KEY);
    if (DataModeService.isMode(stored)) {
      return stored;
    }
    return DataModeService.remembered ?? DataModeService.DEFAULT;
  }

  set(mode: DataMode): void {
    this.store.set(DataModeService.KEY, mode);
    DataModeService.remembered = mode;
  }

  isReplay(): boolean {
    return this.current() === "replay";
  }

  /** Adds `source=<mode>` to a query string (empty, or starting with `?`). */
  withSource(query: string): string {
    const source = `source=${this.current()}`;
    return query ? `${query}&${source}` : `?${source}`;
  }
}

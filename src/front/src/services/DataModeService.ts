import { PreferenceStore } from "@/services/PreferenceStore";

/** Which data the application shows: the live collection, or the replay of historical traffic. */
export type DataMode = "live" | "replay";

export const DATA_MODES: readonly DataMode[] = ["live", "replay"];

/**
 * The data mode chosen by the user, and the way it reaches the API: in the replay, the requests
 * that read aircraft, flights and alerts carry `source=replay`.
 *
 * The choice is remembered like the language and the theme. It is also kept in memory, shared by
 * every instance, so the services that call the API follow it even when the browser storage is
 * blocked and nothing can be remembered.
 */
export class DataModeService {
  static readonly KEY = "aerosafe.mode";
  static readonly DEFAULT: DataMode = "live";

  private static remembered: DataMode | null = null;

  constructor(private readonly store: PreferenceStore = new PreferenceStore()) {}

  static isMode(value: string | null): value is DataMode {
    return value === "live" || value === "replay";
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

  /** Adds `source=replay` to a query string (empty, or starting with `?`) when in the replay. */
  withSource(query: string): string {
    if (!this.isReplay()) {
      return query;
    }
    return query ? `${query}&source=replay` : "?source=replay";
  }
}

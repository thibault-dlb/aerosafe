import { PreferenceStore } from "@/services/PreferenceStore";

/** Metric (m, m/s, km) or aeronautical (ft, kt, NM) display of altitudes, speeds and distances. */
export type UnitSystem = "metric" | "aeronautical";

export const UNIT_SYSTEMS: readonly UnitSystem[] = ["metric", "aeronautical"];

/**
 * The unit system chosen by the user, remembered like the language and the theme.
 * Only the display changes: the API, the rules and their thresholds stay metric.
 */
export class UnitService {
  static readonly KEY = "aerosafe.units";
  static readonly DEFAULT: UnitSystem = "metric";

  constructor(private readonly store: PreferenceStore = new PreferenceStore()) {}

  static isSystem(value: string | null): value is UnitSystem {
    return value === "metric" || value === "aeronautical";
  }

  current(): UnitSystem {
    const stored = this.store.get(UnitService.KEY);
    return UnitService.isSystem(stored) ? stored : UnitService.DEFAULT;
  }

  set(system: UnitSystem): void {
    this.store.set(UnitService.KEY, system);
  }
}

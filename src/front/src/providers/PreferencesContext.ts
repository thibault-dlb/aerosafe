import { createContext } from "react";

import type { TranslationKey } from "@/i18n/fr";
import type { DataMode } from "@/services/DataModeService";
import type { Language } from "@/services/TranslationService";
import type { UnitSystem } from "@/services/UnitService";

export interface Preferences {
  language: Language;
  setLanguage: (language: Language) => void;
  /** Whether the pages show the live collection or the replay of historical traffic. */
  mode: DataMode;
  setMode: (mode: DataMode) => void;
  /** Metric or aeronautical display of altitudes, speeds and distances. */
  units: UnitSystem;
  setUnits: (units: UnitSystem) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

export const PreferencesContext = createContext<Preferences | null>(null);

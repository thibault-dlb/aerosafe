import { createContext } from "react";

import type { TranslationKey } from "@/i18n/fr";
import type { DataMode } from "@/services/DataModeService";
import type { Language } from "@/services/TranslationService";
import type { Theme } from "@/services/ThemeService";

export interface Preferences {
  language: Language;
  setLanguage: (language: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** Whether the pages show the live collection or the replay of historical traffic. */
  mode: DataMode;
  setMode: (mode: DataMode) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

export const PreferencesContext = createContext<Preferences | null>(null);

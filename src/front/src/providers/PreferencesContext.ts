import { createContext } from "react";

import type { TranslationKey } from "@/i18n/fr";
import type { Language } from "@/services/TranslationService";
import type { Theme } from "@/services/ThemeService";

export interface Preferences {
  language: Language;
  setLanguage: (language: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

export const PreferencesContext = createContext<Preferences | null>(null);

import { type ReactNode, useCallback, useMemo, useState } from "react";

import { PreferencesContext, type Preferences } from "@/providers/PreferencesContext";
import { type DataMode, DataModeService } from "@/services/DataModeService";
import { PreferenceStore } from "@/services/PreferenceStore";
import { ThemeService, type Theme } from "@/services/ThemeService";
import { type Language, TranslationService } from "@/services/TranslationService";
import { type UnitSystem, UnitService } from "@/services/UnitService";

export interface PreferencesProviderProps {
  children: ReactNode;
  /** Where the choices are remembered. Tests give their own. */
  store?: PreferenceStore;
}

/** Gives the language, the theme, the data mode, the units and the translation function to the whole application. */
export default function PreferencesProvider({ children, store }: PreferencesProviderProps) {
  const [services] = useState(() => {
    const preferenceStore = store ?? new PreferenceStore();
    const theme = new ThemeService(preferenceStore);
    theme.apply();
    return {
      theme,
      translation: new TranslationService(preferenceStore),
      mode: new DataModeService(preferenceStore),
      units: new UnitService(preferenceStore),
    };
  });
  const [language, setLanguageState] = useState<Language>(() => services.translation.current());
  const [theme, setThemeState] = useState<Theme>(() => services.theme.current());
  const [mode, setModeState] = useState<DataMode>(() => services.mode.current());
  const [units, setUnitsState] = useState<UnitSystem>(() => services.units.current());

  const setLanguage = useCallback(
    (next: Language) => {
      services.translation.set(next);
      setLanguageState(next);
    },
    [services],
  );

  const setTheme = useCallback(
    (next: Theme) => {
      services.theme.set(next);
      setThemeState(next);
    },
    [services],
  );

  const setMode = useCallback(
    (next: DataMode) => {
      services.mode.set(next);
      setModeState(next);
    },
    [services],
  );

  const setUnits = useCallback(
    (next: UnitSystem) => {
      services.units.set(next);
      setUnitsState(next);
    },
    [services],
  );

  const value = useMemo<Preferences>(
    () => ({
      language,
      setLanguage,
      theme,
      setTheme,
      mode,
      setMode,
      units,
      setUnits,
      t: (key, params) => services.translation.t(key, params),
    }),
    [language, setLanguage, theme, setTheme, mode, setMode, units, setUnits, services],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

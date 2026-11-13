import { useContext } from "react";

import { type Preferences, PreferencesContext } from "@/providers/PreferencesContext";

/** The preferences of the user. Must be used under `PreferencesProvider`. */
export function usePreferences(): Preferences {
  const preferences = useContext(PreferencesContext);
  if (!preferences) {
    throw new Error("usePreferences must be used under PreferencesProvider");
  }
  return preferences;
}

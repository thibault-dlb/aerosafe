import { PreferenceStore } from "@/services/PreferenceStore";
import type { Language } from "@/services/TranslationService";

/** A preference store kept in memory, starting in `language`, for the page tests. */
export function memoryStore(language: Language = "en"): PreferenceStore {
  const values = new Map<string, string>([["aerosafe.language", language]]);
  return new PreferenceStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  });
}

import { usePreferences } from "@/hooks/usePreferences";

/** The translation function and the language switch. */
export function useTranslation() {
  const { t, language, setLanguage } = usePreferences();
  return { t, language, setLanguage };
}

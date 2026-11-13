import { usePreferences } from "@/hooks/usePreferences";

/** The colour theme and its switch. */
export function useTheme() {
  const { theme, setTheme } = usePreferences();
  return { theme, setTheme };
}

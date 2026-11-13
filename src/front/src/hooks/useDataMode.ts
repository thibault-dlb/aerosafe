import { usePreferences } from "@/hooks/usePreferences";

/** The data mode (live or replay) and its switch. */
export function useDataMode() {
  const { mode, setMode } = usePreferences();
  return { mode, setMode };
}

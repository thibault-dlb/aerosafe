import { useEffect, useState } from "react";

import { usePreferences } from "@/hooks/usePreferences";
import { AlertService } from "@/services/AlertService";

/** Time between two readings: the Île-de-France collection period. */
export const ALERT_COUNT_REFRESH_MS = 30_000;
/** In the replay the alerts follow the simulated clock: they are read more often. */
export const ALERT_COUNT_REPLAY_REFRESH_MS = 5_000;

/**
 * The number of alerts whose situation lasts, kept up to date for the badge of the menu. Null
 * until the first answer, and when `enabled` is false (only a Supervisor can read the alerts).
 * A failed reading keeps the last number.
 */
export function useActiveAlertCount(enabled: boolean, service?: AlertService): number | null {
  const { mode } = usePreferences();
  const [source] = useState(() => service ?? new AlertService());
  const [count, setCount] = useState<number | null>(null);
  const refreshMs = mode === "replay" ? ALERT_COUNT_REPLAY_REFRESH_MS : ALERT_COUNT_REFRESH_MS;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function refresh() {
      try {
        const page = await source.search({ status: "active", limit: 1 });
        if (!cancelled) setCount(page.total);
      } catch {
        // The badge is a convenience: the last number stays.
      }
      if (!cancelled) timer = setTimeout(() => void refresh(), refreshMs);
    }

    void refresh();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, source, refreshMs]);

  return enabled ? count : null;
}

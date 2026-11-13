import { useEffect, useMemo, useState } from "react";

import AircraftMap from "@/components/map/AircraftMap";
import { ButtonLink } from "@/components/ui/Button";
import Notice from "@/components/ui/Notice";
import Panel from "@/components/ui/Panel";
import StatTile from "@/components/ui/StatTile";
import { usePreferences } from "@/hooks/usePreferences";
import { useReplay } from "@/hooks/useReplay";
import { type LiveOverviewData, LiveOverviewService } from "@/services/LiveOverviewService";
import type { MapPosition } from "@/services/MapService";
import { ReplayTime } from "@/services/ReplayTime";

import styles from "./LiveOverview.module.css";

/** Time between two refreshes: the Île-de-France collection period. */
export const REFRESH_MS = 30_000;
/** In the replay the traffic moves with the simulated clock: the figures are read more often. */
export const REPLAY_REFRESH_MS = 5_000;

export interface LiveOverviewProps {
  /** Where the figures come from. Tests give their own. */
  service?: LiveOverviewService;
  /** Gives the map most of the height of the window (the dashboard). */
  large?: boolean;
}

/**
 * Live figures and map. They need a login, and the alert figures a Supervisor: without them
 * the page keeps working and invites the visitor to log in.
 */
export default function LiveOverview({ service, large = false }: LiveOverviewProps) {
  const { t, language, mode } = usePreferences();
  const replay = useReplay();
  const [source] = useState(() => service ?? new LiveOverviewService());
  const [overview, setOverview] = useState<LiveOverviewData | null>(null);
  const refreshMs = mode === "replay" ? REPLAY_REFRESH_MS : REFRESH_MS;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function refresh() {
      const next = await source.load();
      if (cancelled) return;
      setOverview(next);
      // Without a login there is nothing to refresh: stop asking until the page is opened again.
      if (next.aircraft.state !== "unauthenticated") {
        timer = setTimeout(() => void refresh(), refreshMs);
      }
    }

    void refresh();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [source, refreshMs]);

  const positions = useMemo<MapPosition[]>(
    () =>
      overview?.aircraft.state === "ready"
        ? overview.aircraft.data.map((aircraft) => ({
            latitude: aircraft.latitude as number,
            longitude: aircraft.longitude as number,
            label: aircraft.displayName,
          }))
        : [],
    [overview],
  );

  const replaying = mode === "replay";
  const instant = replay?.now ?? null;
  let title = t("overview.live.title");
  if (replaying) {
    title = instant
      ? t("overview.replay.title", { time: ReplayTime.short(instant, language) })
      : t("overview.replay.waiting");
  }

  if (!overview) {
    return (
      <Panel title={title}>
        <p role="status">{t("overview.live.loading")}</p>
      </Panel>
    );
  }

  if (overview.aircraft.state === "unauthenticated") {
    return (
      <Panel title={title}>
        <div className={styles.login}>
          <p>{t(replaying ? "overview.replay.login" : "overview.live.login")}</p>
          <ButtonLink to="/login">{t("home.cta.login")}</ButtonLink>
        </div>
      </Panel>
    );
  }

  const failed = [overview.aircraft, overview.activeAlerts, overview.dayAlerts].some(
    (part) => part.state === "failed",
  );

  return (
    <Panel title={title}>
      {failed && (
        <Notice variant="warning" className={styles.notice}>
          {t("overview.live.error")}
        </Notice>
      )}
      <div className={styles.tiles}>
        {overview.aircraft.state === "ready" && (
          <StatTile label={t("overview.stat.aircraft")} value={overview.aircraft.data.length} />
        )}
        {overview.activeAlerts.state === "ready" && (
          <StatTile label={t("overview.stat.active")} value={overview.activeAlerts.data} />
        )}
        {overview.dayAlerts.state === "ready" && (
          <StatTile label={t("overview.stat.day")} value={overview.dayAlerts.data} />
        )}
      </div>
      {overview.aircraft.state === "ready" && (
        <div className={large ? styles.large : undefined}>
          <AircraftMap aircraft={positions} />
        </div>
      )}
    </Panel>
  );
}

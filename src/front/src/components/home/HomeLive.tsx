import { useEffect, useMemo, useState } from "react";

import AircraftMap from "@/components/map/AircraftMap";
import { ButtonLink } from "@/components/ui/Button";
import Notice from "@/components/ui/Notice";
import Panel from "@/components/ui/Panel";
import StatTile from "@/components/ui/StatTile";
import { useTranslation } from "@/hooks/useTranslation";
import { type HomeOverview, HomeOverviewService } from "@/services/HomeOverviewService";
import type { MapPosition } from "@/services/MapService";

import styles from "./HomeLive.module.css";

/** Time between two refreshes: the Île-de-France collection period. */
export const REFRESH_MS = 30_000;

export interface HomeLiveProps {
  /** Where the figures come from. Tests give their own. */
  service?: HomeOverviewService;
}

/**
 * Live figures and map. They need a login, and the alert figures a Supervisor: without them
 * the page keeps working and invites the visitor to log in.
 */
export default function HomeLive({ service }: HomeLiveProps) {
  const { t } = useTranslation();
  const [source] = useState(() => service ?? new HomeOverviewService());
  const [overview, setOverview] = useState<HomeOverview | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function refresh() {
      const next = await source.load();
      if (cancelled) return;
      setOverview(next);
      // Without a login there is nothing to refresh: stop asking until the page is opened again.
      if (next.aircraft.state !== "unauthenticated") {
        timer = setTimeout(() => void refresh(), REFRESH_MS);
      }
    }

    void refresh();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [source]);

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

  const title = t("home.live.title");

  if (!overview) {
    return (
      <Panel title={title}>
        <p role="status">{t("home.live.loading")}</p>
      </Panel>
    );
  }

  if (overview.aircraft.state === "unauthenticated") {
    return (
      <Panel title={title}>
        <div className={styles.login}>
          <p>{t("home.live.login")}</p>
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
          {t("home.live.error")}
        </Notice>
      )}
      <div className={styles.tiles}>
        {overview.aircraft.state === "ready" && (
          <StatTile label={t("home.stat.aircraft")} value={overview.aircraft.data.length} />
        )}
        {overview.activeAlerts.state === "ready" && (
          <StatTile label={t("home.stat.active")} value={overview.activeAlerts.data} />
        )}
        {overview.dayAlerts.state === "ready" && (
          <StatTile label={t("home.stat.day")} value={overview.dayAlerts.data} />
        )}
      </div>
      {overview.aircraft.state === "ready" && <AircraftMap aircraft={positions} />}
    </Panel>
  );
}

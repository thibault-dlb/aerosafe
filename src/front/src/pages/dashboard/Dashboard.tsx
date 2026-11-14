import { useCallback, useEffect, useMemo, useState } from "react";

import ActiveAlerts from "@/components/dashboard/ActiveAlerts";
import AlertChart from "@/components/dashboard/AlertChart";
import CollectionPanel from "@/components/dashboard/CollectionPanel";
import CounterRow from "@/components/dashboard/CounterRow";
import styles from "@/components/dashboard/Dashboard.module.css";
import AircraftMap from "@/components/map/AircraftMap";
import Notice from "@/components/ui/Notice";
import Panel from "@/components/ui/Panel";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/hooks/usePreferences";
import { useReplay } from "@/hooks/useReplay";
import { useToast } from "@/hooks/useToast";
import type { Aircraft } from "@/models/Aircraft";
import type { Alert } from "@/models/Alert";
import type { Dashboard as DashboardData, DashboardStatistics, StatisticsPeriod } from "@/models/Dashboard";
import { AlertService } from "@/services/AlertService";
import { CollectionService } from "@/services/CollectionService";
import { DashboardService } from "@/services/DashboardService";
import { ErrorMessages } from "@/services/ErrorMessages";
import type { MapPosition } from "@/services/MapService";
import { ReplayTime } from "@/services/ReplayTime";

/** Time between two refreshes: the Île-de-France collection period. */
export const REFRESH_MS = 30_000;
/** In the replay the traffic moves with the simulated clock: the figures are read more often. */
export const REPLAY_REFRESH_MS = 5_000;

export interface DashboardProps {
  /** Where the figures come from. Tests give their own. */
  service?: DashboardService;
  alertService?: AlertService;
  collectionService?: CollectionService;
}

/**
 * The dashboard, open to every account: the figures, the map, the latest active alerts, the chart
 * of alerts and the state of the collection. Only the Supervisor gets the buttons that act.
 */
export default function Dashboard({ service, alertService, collectionService }: DashboardProps) {
  const { t, language, mode } = usePreferences();
  const { user } = useAuth();
  const replay = useReplay();
  const toast = useToast();
  const supervisor = user?.isSupervisor === true;
  const api = useMemo(() => service ?? new DashboardService(), [service]);
  const alerts = useMemo(() => alertService ?? new AlertService(), [alertService]);
  const collection = useMemo(() => collectionService ?? new CollectionService(), [collectionService]);

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [aircraft, setAircraft] = useState<Aircraft[] | null>(null);
  const [statistics, setStatistics] = useState<DashboardStatistics | null>(null);
  const [period, setPeriod] = useState<StatisticsPeriod>("24h");
  const [failed, setFailed] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refreshMs = mode === "replay" ? REPLAY_REFRESH_MS : REFRESH_MS;

  const refresh = useCallback(async () => {
    const [overview, tracked, chart] = await Promise.allSettled([
      api.load(),
      api.trackedAircraft(),
      api.statistics(period),
    ]);
    if (overview.status === "fulfilled") setDashboard(overview.value);
    if (tracked.status === "fulfilled") setAircraft(tracked.value);
    if (chart.status === "fulfilled") setStatistics(chart.value);
    setFailed([overview, tracked, chart].some((part) => part.status === "rejected"));
  }, [api, period]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      await refresh();
      if (!cancelled) timer = setTimeout(() => void tick(), refreshMs);
    }

    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [refresh, refreshMs]);

  const positions = useMemo<MapPosition[]>(() => {
    const level = new Map(dashboard?.latestAlerts.map((alert) => [alert.aircraftId, alert.criticality]));
    return (aircraft ?? []).map((item) => ({
      latitude: item.latitude as number,
      longitude: item.longitude as number,
      label: item.displayName,
      altitude: item.altitude,
      heading: item.heading,
      onGround: item.onGround,
      criticality: level.get(item.id) ?? null,
    }));
  }, [aircraft, dashboard]);

  async function process(alert: Alert) {
    setProcessingId(alert.id);
    try {
      await alerts.process(alert.id);
      toast.notify({ message: t("alerts.toast.processed", { rule: alert.ruleCode, aircraft: alert.aircraftName }) });
      await refresh();
    } catch (failure) {
      toast.notify({ message: t(ErrorMessages.SUPERVISOR.key(failure)), tone: "error" });
    } finally {
      setProcessingId(null);
    }
  }

  async function act(action: () => Promise<void>, done: "paused" | "resumed" | "ran") {
    setBusy(true);
    try {
      await action();
      toast.notify({ message: t(`dashboard.collection.toast.${done}`) });
      await refresh();
    } catch (failure) {
      toast.notify({ message: t(ErrorMessages.COLLECTION.key(failure)), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  const replaying = mode === "replay";
  const instant = replay?.now ?? null;
  let mapTitle = t("overview.live.title");
  if (replaying) {
    mapTitle = instant
      ? t("overview.replay.title", { time: ReplayTime.short(instant, language) })
      : t("overview.replay.waiting");
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{t("nav.dashboard")}</h1>
      {failed && <Notice variant="warning">{t("dashboard.error")}</Notice>}
      {dashboard ? (
        <>
          <CounterRow
            aircraft={aircraft ? aircraft.length : null}
            active={dashboard.activeAlerts}
            unprocessed={dashboard.unprocessedAlerts}
            last24h={dashboard.alertsLast24h}
          />
          <div className={styles.main}>
            <Panel title={mapTitle}>
              <div className={styles.map}>
                <AircraftMap aircraft={positions} />
              </div>
            </Panel>
            <ActiveAlerts
              alerts={dashboard.latestAlerts}
              total={dashboard.activeAlerts}
              onProcess={supervisor ? (alert) => void process(alert) : undefined}
              processingId={processingId}
              linkToAlerts={supervisor}
            />
          </div>
          <div className={styles.below}>
            <AlertChart statistics={statistics} period={period} onPeriod={setPeriod} />
            <CollectionPanel
              collection={dashboard.collection}
              busy={busy}
              onPause={supervisor ? () => void act(() => collection.pause(), "paused") : undefined}
              onResume={supervisor ? () => void act(() => collection.resume(), "resumed") : undefined}
              onRun={supervisor ? () => void act(() => collection.runNow(), "ran") : undefined}
            />
          </div>
        </>
      ) : (
        !failed && <p role="status">{t("overview.live.loading")}</p>
      )}
    </main>
  );
}

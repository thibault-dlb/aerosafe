import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import ActiveAlerts from "@/components/dashboard/ActiveAlerts";
import AlertChart from "@/components/dashboard/AlertChart";
import CollectionPanel from "@/components/dashboard/CollectionPanel";
import CounterRow from "@/components/dashboard/CounterRow";
import styles from "@/components/dashboard/Dashboard.module.css";
import { FindAircraft, MapTools } from "@/components/dashboard/MapTools";
import TrackedAircraft from "@/components/dashboard/TrackedAircraft";
import TrafficMap, { type TrafficMapHandle } from "@/components/map/TrafficMap";
import Notice from "@/components/ui/Notice";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/hooks/usePreferences";
import { useReplay } from "@/hooks/useReplay";
import { useToast } from "@/hooks/useToast";
import type { Aircraft } from "@/models/Aircraft";
import type { Alert } from "@/models/Alert";
import type { Dashboard as DashboardData, DashboardStatistics, StatisticsPeriod } from "@/models/Dashboard";
import { type FlightPoint, TrafficAircraftFactory } from "@/models/Traffic";
import { AlertService } from "@/services/AlertService";
import { AlertsPanelPreference } from "@/services/AlertsPanelPreference";
import { CollectionService, type LiveSource } from "@/services/CollectionService";
import { DashboardService } from "@/services/DashboardService";
import { ErrorMessages } from "@/services/ErrorMessages";
import { FlightHistory } from "@/services/FlightHistory";
import { ReplayTime } from "@/services/ReplayTime";
import { AircraftPolling } from "@/services/AircraftPolling";

/**
 * Time between two refreshes of the figures and the aircraft of a live source: its collection period,
 * until the dashboard gives it (OpenSky every 30 s, adsb.fi every 5 s).
 */
const LIVE_REFRESH_MS: Record<LiveSource, number> = { opensky: 30_000, adsbfi: 5_000 };
/** In the replay the traffic moves with the simulated clock: the figures are read more often. */
export const REPLAY_REFRESH_MS = 5_000;
/** A click on an alert zooms in to this level if the map is further out, so its aircraft can be centred. */
export const ALERT_FOCUS_ZOOM = 7;

export interface DashboardProps {
  /** Where the figures come from. Tests give their own. */
  service?: DashboardService;
  alertService?: AlertService;
  collectionService?: CollectionService;
  /** Remembers whether the alerts panel is folded. Tests give their own. */
  alertsPanelPreference?: AlertsPanelPreference;
}

/**
 * The dashboard, open to every account: a map of the whole traffic filling the screen, with the figures,
 * the latest active alerts and the aircraft that is followed floating over it; under it the chart of
 * alerts and the state of the collection. Only the Supervisor gets the buttons that act.
 */
export default function Dashboard({ service, alertService, collectionService, alertsPanelPreference }: DashboardProps) {
  const { t, language, mode } = usePreferences();
  const { user } = useAuth();
  const replay = useReplay();
  const toast = useToast();
  const navigate = useNavigate();
  const supervisor = user?.isSupervisor === true;
  const api = useMemo(() => service ?? new DashboardService(), [service]);
  const alerts = useMemo(() => alertService ?? new AlertService(), [alertService]);
  const collection = useMemo(() => collectionService ?? new CollectionService(), [collectionService]);

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [aircraft, setAircraft] = useState<Aircraft[] | null>(null);
  const [statistics, setStatistics] = useState<DashboardStatistics | null>(null);
  const [chartPeriod, setChartPeriod] = useState<StatisticsPeriod>("24h");
  const [failed, setFailed] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [trackedId, setTrackedId] = useState<string | null>(null);
  const [trackedAircraft, setTrackedAircraft] = useState<Aircraft | null>(null);
  const [following, setFollowing] = useState(false);
  const [history, setHistory] = useState<FlightPoint[]>([]);
  const [savedAlertsPanel] = useState(() => alertsPanelPreference ?? new AlertsPanelPreference());
  // Until the visitor chooses, the panel is open, except on a narrow screen where it would hide the map.
  const [alertsOpen, setAlertsOpen] = useState(() =>
    savedAlertsPanel.isOpen(!window.matchMedia?.("(max-width: 720px)").matches),
  );
  const [fullscreen, setFullscreen] = useState(false);
  // The alert last clicked: a second click on it, once its aircraft is centred, opens it in the alerts.
  const [focusedAlertId, setFocusedAlertId] = useState<string | null>(null);
  const stage = useRef<HTMLElement>(null);
  const map = useRef<TrafficMapHandle>(null);
  const replaying = mode === "replay";
  // The live source shown, and adsb.fi for the state of the collection during a replay.
  const source: LiveSource = mode === "opensky" ? "opensky" : "adsbfi";
  const collectionPeriod = dashboard?.collection.source === source ? dashboard.collection.periodSeconds : null;
  const liveMs = collectionPeriod ? collectionPeriod * 1000 : LIVE_REFRESH_MS[source];
  const refreshMs = replaying ? REPLAY_REFRESH_MS : liveMs;
  const speed = replay?.state?.speed ?? 1;
  const aircraftMs = replaying ? AircraftPolling.replay(speed) : liveMs;
  // The collection read last, for the area and the pace of the aircraft search, which runs on its own timer.
  const collectionRef = useRef<DashboardData["collection"] | null>(null);
  collectionRef.current = dashboard?.collection.source === source ? dashboard.collection : null;

  // The latest replay, read by the clock of the map, which runs outside React.
  const replayRef = useRef(replay);
  replayRef.current = replay;
  const clock = useCallback(() => (replayRef.current?.state?.now()?.getTime() ?? Date.now()), []);
  const trackedRef = useRef<string | null>(null);
  trackedRef.current = trackedId;

  const refresh = useCallback(async () => {
    const [overview, chart] = await Promise.allSettled([api.load(), api.statistics(chartPeriod)]);
    if (overview.status === "fulfilled") setDashboard(overview.value);
    if (chart.status === "fulfilled") setStatistics(chart.value);
    return [overview, chart].some((part) => part.status === "rejected");
  }, [api, chartPeriod]);

  const refreshAircraft = useCallback(async () => {
    try {
      setAircraft(await api.trackedAircraft(collectionRef.current));
      return false;
    } catch {
      return true;
    }
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      const problem = await refresh();
      if (!cancelled) setFailed(problem);
      if (!cancelled) timer = setTimeout(() => void tick(), refreshMs);
    }

    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [refresh, refreshMs]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      const problem = await refreshAircraft();
      if (!cancelled && problem) setFailed(true);
      if (!cancelled) timer = setTimeout(() => void tick(), aircraftMs);
    }

    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [refreshAircraft, aircraftMs]);

  const stopTracking = useCallback(() => {
    setTrackedId(null);
    setTrackedAircraft(null);
    setFollowing(false);
    setHistory([]);
  }, []);

  // The aircraft of the live mode are not those of the replay.
  useEffect(() => {
    setAircraft(null);
    stopTracking();
  }, [mode, stopTracking]);

  const track = useCallback(
    async (item: Aircraft) => {
      setTrackedId(item.id);
      setTrackedAircraft(item);
      setFollowing(true);
      setHistory([]);
      try {
        const points = await api.flightOf(item.id);
        if (trackedRef.current === item.id) setHistory(points);
      } catch {
        // The card still works without the flight: the line behind the aircraft grows from now on.
      }
    },
    [api],
  );

  // The followed aircraft: its identity stays current, and each new report adds a point to its flight.
  useEffect(() => {
    if (trackedId === null || aircraft === null) return;
    const found = aircraft.find((item) => item.id === trackedId);
    if (!found) return;
    setTrackedAircraft(found);
    if (found.latitude !== null && found.longitude !== null && found.lastContactAt) {
      const point = { at: found.lastContactAt.getTime(), lat: found.latitude, lon: found.longitude, altitude: found.altitude };
      setHistory((points) => FlightHistory.append(points, point));
    }
  }, [aircraft, trackedId]);

  const traffic = useMemo(
    () => TrafficAircraftFactory.from(aircraft ?? [], dashboard?.alertedAircraft ?? []),
    [aircraft, dashboard],
  );
  const alertOf = useMemo(() => {
    const found = new Map<string, Alert>();
    for (const alert of dashboard?.alertedAircraft ?? []) found.set(alert.aircraftId, alert);
    return found;
  }, [dashboard]);

  const pick = useCallback(
    (id: string | null) => {
      const item = id === null ? undefined : aircraft?.find((candidate) => candidate.id === id);
      if (item) void track(item);
      else stopTracking();
    },
    [aircraft, track, stopTracking],
  );

  /**
   * A click on an alert: the first one centres the map on its aircraft, the second one (the aircraft is
   * still the one followed) opens the alert in the alerts page. Only the Supervisor has that page; an
   * alert whose aircraft is not on the map goes there at once.
   */
  const selectAlert = useCallback(
    (alert: Alert) => {
      const centred = focusedAlertId === alert.id && trackedId === alert.aircraftId;
      const item = aircraft?.find((candidate) => candidate.id === alert.aircraftId);
      if (centred || !item) {
        if (supervisor) navigate(`/alerts?alert=${encodeURIComponent(alert.id)}`);
        return;
      }
      setFocusedAlertId(alert.id);
      void track(item);
      map.current?.zoomAtLeast(ALERT_FOCUS_ZOOM);
    },
    [aircraft, focusedAlertId, navigate, supervisor, track, trackedId],
  );
  const centredAlertId =
    dashboard?.latestAlerts.find((alert) => alert.id === focusedAlertId && alert.aircraftId === trackedId)?.id ?? null;

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stage.current && stage.current !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleAlertsPanel() {
    savedAlertsPanel.setOpen(!alertsOpen);
    setAlertsOpen(!alertsOpen);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stage.current?.requestFullscreen?.();
  }

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

  async function act(action: (live: LiveSource) => Promise<void>, done: "paused" | "resumed" | "ran") {
    setBusy(true);
    try {
      await action(source);
      toast.notify({ message: t(`dashboard.collection.toast.${done}`) });
      await refresh();
    } catch (failure) {
      toast.notify({ message: t(ErrorMessages.COLLECTION.key(failure)), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  const instant = replay?.now ?? null;
  let mapTitle = t(source === "opensky" ? "overview.opensky.title" : "overview.adsbfi.title");
  if (replaying) {
    mapTitle = instant
      ? t("overview.replay.title", { time: ReplayTime.short(instant, language) })
      : t("overview.replay.waiting");
  }
  const liveArea = collectionRef.current?.area ?? null;
  const bounds = replaying ? DashboardService.HISTORICAL_AREA : (liveArea?.bounds ?? DashboardService.AREA);
  const zone = replaying ? "outline" : (liveArea?.zone ?? DashboardService.AREA);
  const tracked = trackedAircraft && trackedId ? trackedAircraft : null;

  return (
    <main className={styles.page}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{t("nav.dashboard")}</h1>
        <h2 className={styles.mapTitle}>{mapTitle}</h2>
      </div>
      {failed && <Notice variant="warning">{t("dashboard.error")}</Notice>}
      {dashboard ? (
        <>
          <section ref={stage} className={styles.stage} aria-label={mapTitle}>
            <TrafficMap
              ref={map}
              aircraft={traffic}
              clock={clock}
              bounds={bounds}
              zone={zone}
              trackedId={trackedId}
              following={following}
              trail={history}
              onPick={pick}
              onUserMove={() => setFollowing(false)}
              label={t("dashboard.map.label", { count: traffic.length })}
            />
            <div className={styles.counterBar}>
              <CounterRow
                aircraft={aircraft ? aircraft.length : null}
                active={dashboard.activeAlerts}
                unprocessed={dashboard.unprocessedAlerts}
                last24h={dashboard.alertsLast24h}
              />
            </div>
            <div className={styles.left}>
              <FindAircraft aircraft={aircraft ?? []} onFind={(item) => void track(item)} />
              {tracked && (
                <TrackedAircraft
                  aircraft={tracked}
                  describe={(id) => map.current?.describe(id) ?? null}
                  alert={alertOf.get(tracked.id) ?? null}
                  history={history}
                  following={following}
                  onFollow={setFollowing}
                  onClose={stopTracking}
                />
              )}
            </div>
            <div className={styles.right}>
              <div className={styles.alertDock} data-covered={tracked ? "true" : undefined}>
                <button type="button" className={styles.alertToggle} aria-expanded={alertsOpen} onClick={toggleAlertsPanel}>
                  {alertsOpen ? t("dashboard.map.alerts.hide") : t("dashboard.map.alerts.show", { count: dashboard.activeAlerts })}
                </button>
                {alertsOpen && (
                  <ActiveAlerts
                    alerts={dashboard.latestAlerts}
                    total={dashboard.activeAlerts}
                    onProcess={supervisor ? (alert) => void process(alert) : undefined}
                    processingId={processingId}
                    linkToAlerts={supervisor}
                    onSelect={selectAlert}
                    selectedId={centredAlertId}
                  />
                )}
              </div>
              <div className={styles.tools}>
                <MapTools
                  fullscreen={fullscreen}
                  onRecenter={() => map.current?.recenter()}
                  onFullscreen={toggleFullscreen}
                  onZoom={(levels) => map.current?.zoomBy(levels)}
                />
              </div>
            </div>
          </section>
          <div className={styles.below}>
            <AlertChart statistics={statistics} period={chartPeriod} onPeriod={setChartPeriod} />
            <CollectionPanel
              collection={dashboard.collection}
              busy={busy}
              onPause={supervisor ? () => void act((live) => collection.pause(live), "paused") : undefined}
              onResume={supervisor ? () => void act((live) => collection.resume(live), "resumed") : undefined}
              onRun={supervisor ? () => void act((live) => collection.runNow(live), "ran") : undefined}
            />
          </div>
        </>
      ) : (
        !failed && <p role="status">{t("overview.live.loading")}</p>
      )}
    </main>
  );
}

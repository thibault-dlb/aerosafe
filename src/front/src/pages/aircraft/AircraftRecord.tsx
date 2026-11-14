import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import AircraftBanner from "@/components/aircraft/AircraftBanner";
import AircraftMap from "@/components/map/AircraftMap";
import Breadcrumb from "@/components/ui/Breadcrumb";
import { ButtonLink } from "@/components/ui/Button";
import CriticalityMark from "@/components/ui/CriticalityMark";
import EmptyState from "@/components/ui/EmptyState";
import Notice from "@/components/ui/Notice";
import Panel from "@/components/ui/Panel";
import Pill from "@/components/ui/Pill";
import StatTile from "@/components/ui/StatTile";
import Table from "@/components/ui/Table";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/hooks/usePreferences";
import type { TranslationKey } from "@/i18n/fr";
import type { Aircraft, Observation } from "@/models/Aircraft";
import { CriticalityRank, type Criticality } from "@/models/Alert";
import type { Flight } from "@/models/Flight";
import { AircraftService } from "@/services/AircraftService";
import { AlertService } from "@/services/AlertService";
import { Formatter } from "@/services/Formatter";

import styles from "./AircraftRecord.module.css";
import { errorKey } from "./errors";

/** Number of latest observations shown on the record. */
export const HISTORY_SIZE = 50;

interface RecordData {
  aircraft: Aircraft;
  observations: Observation[];
  flights: Flight[];
}

export interface AircraftRecordProps {
  service?: AircraftService;
  /** Where the alerts in progress come from, for a Supervisor. */
  alertService?: AlertService;
}

/** UC-01, step 4: general information, latest flight parameters and flights of an aircraft. */
export default function AircraftRecord({ service, alertService }: AircraftRecordProps) {
  const { t, units } = usePreferences();
  const { user } = useAuth();
  const { aircraftId = "" } = useParams();
  const api = useMemo(() => service ?? new AircraftService(), [service]);
  const alertsApi = useMemo(() => alertService ?? new AlertService(), [alertService]);
  const supervisor = user?.isSupervisor === true;
  const [data, setData] = useState<RecordData | null>(null);
  const [error, setError] = useState<TranslationKey | null>(null);
  // The alerts in progress of the aircraft, which only a Supervisor can read.
  const [alertLevels, setAlertLevels] = useState<(Criticality | null)[]>([]);

  useEffect(() => {
    let active = true;
    setData(null);
    setError(null);
    Promise.all([
      api.get(aircraftId),
      api.observations(aircraftId, { limit: HISTORY_SIZE }),
      api.flights(aircraftId),
    ])
      .then(([aircraft, observations, flights]) => {
        if (active) setData({ aircraft, observations, flights });
      })
      .catch((failure: unknown) => {
        if (active) setError(errorKey(failure, "aircraft.record.notFound"));
      });
    return () => {
      active = false;
    };
  }, [api, aircraftId]);

  const icao24 = data?.aircraft.icao24;
  useEffect(() => {
    setAlertLevels([]);
    if (!supervisor || !icao24) return;
    let active = true;
    alertsApi.search({ icao24, status: "active", limit: 50 }).then(
      (page) => {
        // The address filter is a prefix: keep the alerts of this very aircraft.
        if (active) setAlertLevels(page.items.filter((alert) => alert.icao24 === icao24).map((alert) => alert.criticality));
      },
      // The record works without them: the badge is a bonus.
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [alertsApi, supervisor, icao24]);

  const criticality = CriticalityRank.highest(alertLevels);
  const position = useMemo(() => {
    const aircraft = data?.aircraft;
    if (!aircraft?.hasPosition) return [];
    return [
      {
        latitude: aircraft.latitude as number,
        longitude: aircraft.longitude as number,
        altitude: aircraft.altitude,
        heading: aircraft.heading,
        onGround: aircraft.onGround,
        criticality,
        label: aircraft.displayName,
      },
    ];
  }, [data, criticality]);

  const title = <h1 className={styles.title}>{t("aircraft.record.title")}</h1>;

  if (error) {
    return (
      <main className={styles.page}>
        {title}
        <Notice variant="danger">{t(error)}</Notice>
        <div>
          <ButtonLink to="/aircraft" variant="secondary">
            {t("aircraft.record.back")}
          </ButtonLink>
        </div>
      </main>
    );
  }
  if (!data) {
    return (
      <main className={styles.page}>
        {title}
        <p role="status" className={styles.muted}>
          {t("aircraft.loading")}
        </p>
      </main>
    );
  }

  const { aircraft, observations, flights } = data;
  const latest = observations.at(-1);
  const latestFirst = [...observations].reverse();
  const unknown = t("aircraft.unknown");
  const altitude = aircraft.altitude ?? latest?.altitude ?? null;
  const heading = aircraft.heading ?? latest?.heading ?? null;
  const onGround = aircraft.onGround;

  return (
    <main className={styles.page}>
      <Breadcrumb items={[{ label: t("nav.aircraft"), to: "/aircraft" }, { label: aircraft.displayName }]} />

      <AircraftBanner
        title={aircraft.displayName}
        subtitle={
          <>
            {aircraft.model ?? unknown} · {aircraft.airline ?? unknown} · {t("aircraft.field.icao24")} <span className="mono">{aircraft.icao24}</span>
          </>
        }
        badges={
          <>
            {onGround !== null && (
              <Pill tone={onGround ? "neutral" : "air"}>{t(onGround ? "aircraft.state.ground" : "aircraft.state.airborne")}</Pill>
            )}
            {supervisor && alertLevels.length > 0 && (
              <>
                <CriticalityMark level={criticality} variant="badge" />
                <Pill tone="active">
                  {t(alertLevels.length === 1 ? "aircraft.record.activeAlerts.one" : "aircraft.record.activeAlerts.many", {
                    count: alertLevels.length,
                  })}
                </Pill>
              </>
            )}
          </>
        }
      >
        <StatTile label={t("aircraft.record.altitude")} value={Formatter.altitude(altitude, units)} />
        <StatTile label={t("aircraft.record.speed")} value={Formatter.speed(latest?.speed ?? null, units)} />
        <StatTile label={t("aircraft.record.heading")} value={Formatter.number(heading, "°")} />
        <StatTile
          label={t("aircraft.lastSeen")}
          value={aircraft.lastContactAt ? aircraft.lastContactAt.toLocaleTimeString() : t("aircraft.never")}
          hint={aircraft.lastContactAt ? aircraft.lastContactAt.toLocaleDateString() : undefined}
        />
      </AircraftBanner>

      <Panel title={t("aircraft.record.map")}>
        {position.length > 0 ? (
          <AircraftMap aircraft={position} size="large" label={t("map.label", { count: 1 })} />
        ) : (
          <EmptyState kind="results" title={t("aircraft.search.empty.title")}>
            {t("aircraft.record.noPosition")}
          </EmptyState>
        )}
      </Panel>

      <div className={styles.two}>
        <Panel title={t("aircraft.record.flights")}>
          {flights.length === 0 ? (
            <EmptyState kind="flights" title={t("aircraft.record.flights")}>
              {t("aircraft.record.noFlight")}
            </EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t("flight.column.flight")}</th>
                  <th scope="col">{t("flight.column.start")}</th>
                  <th scope="col">{t("flight.column.end")}</th>
                  <th scope="col">{t("flight.column.route")}</th>
                </tr>
              </thead>
              <tbody>
                {flights.map((flight) => (
                  <tr key={flight.id}>
                    <td>
                      <Link to={`/flights/${flight.id}`} className="mono">
                        {flight.displayName}
                      </Link>
                    </td>
                    <td className="mono">{Formatter.date(flight.startedAt)}</td>
                    <td className="mono">
                      {flight.inProgress ? <Pill tone="air">{t("flight.pill.inProgress")}</Pill> : Formatter.date(flight.endedAt)}
                    </td>
                    <td className="mono">
                      {flight.origin || flight.destination
                        ? `${flight.origin ?? t("flight.unknownAirport")} → ${flight.destination ?? t("flight.unknownAirport")}`
                        : Formatter.MISSING}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>

        <Panel title={t("aircraft.record.history")}>
          {observations.length === 0 ? (
            <p className={styles.muted}>{t("aircraft.record.noObservation")}</p>
          ) : (
            <Table>
              <caption>{t("aircraft.record.historyCaption", { count: observations.length })}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("aircraft.column.time")}</th>
                  <th scope="col">{t("aircraft.column.altitude")}</th>
                  <th scope="col">{t("aircraft.column.speed")}</th>
                  <th scope="col">{t("aircraft.column.heading")}</th>
                  <th scope="col">{t("aircraft.column.position")}</th>
                  <th scope="col">{t("aircraft.column.state")}</th>
                </tr>
              </thead>
              <tbody>
                {latestFirst.map((observation) => (
                  <tr key={observation.lastContactAt.toISOString()}>
                    <td className="mono">{Formatter.date(observation.lastContactAt)}</td>
                    <td className="mono">{Formatter.altitude(observation.altitude, units)}</td>
                    <td className="mono">{Formatter.speed(observation.speed, units)}</td>
                    <td className="mono">{Formatter.number(observation.heading, "°")}</td>
                    <td className="mono">
                      {observation.hasPosition
                        ? `${observation.latitude?.toFixed(4)}, ${observation.longitude?.toFixed(4)}`
                        : Formatter.MISSING}
                    </td>
                    <td>
                      <Pill tone={observation.onGround ? "neutral" : "air"}>
                        {t(observation.onGround ? "aircraft.state.ground" : "aircraft.state.airborne")}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>
    </main>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import AircraftMap from "@/components/map/AircraftMap";
import { ButtonLink } from "@/components/ui/Button";
import Notice from "@/components/ui/Notice";
import Panel from "@/components/ui/Panel";
import Table from "@/components/ui/Table";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/fr";
import type { Aircraft, Observation } from "@/models/Aircraft";
import type { Flight } from "@/models/Flight";
import { AircraftService } from "@/services/AircraftService";
import { Formatter } from "@/services/Formatter";

import styles from "./Aircraft.module.css";
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
}

/** UC-01, step 4: general information, latest flight parameters and flights of an aircraft. */
export default function AircraftRecord({ service }: AircraftRecordProps) {
  const { t } = useTranslation();
  const { aircraftId = "" } = useParams();
  const api = useMemo(() => service ?? new AircraftService(), [service]);
  const [data, setData] = useState<RecordData | null>(null);
  const [error, setError] = useState<TranslationKey | null>(null);

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

  const position = useMemo(() => {
    const aircraft = data?.aircraft;
    if (!aircraft?.hasPosition) return [];
    return [
      {
        latitude: aircraft.latitude as number,
        longitude: aircraft.longitude as number,
        altitude: aircraft.altitude,
        label: aircraft.displayName,
      },
    ];
  }, [data]);

  const title = <h1>{t("aircraft.record.title")}</h1>;

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
  const latestFirst = [...observations].reverse();
  const unknown = t("aircraft.unknown");
  return (
    <main className={styles.page}>
      {title}
      <h2 className="mono">{aircraft.displayName}</h2>

      <div className={styles.columns}>
        <Panel title={t("aircraft.record.identity")}>
          <dl className={styles.facts}>
            <dt>{t("aircraft.search.icao24")}</dt>
            <dd className="mono">{aircraft.icao24}</dd>
            <dt>{t("aircraft.search.registration")}</dt>
            <dd className="mono">{aircraft.registration ?? unknown}</dd>
            <dt>{t("aircraft.column.model")}</dt>
            <dd>{aircraft.model ?? unknown}</dd>
            <dt>{t("aircraft.column.airline")}</dt>
            <dd>{aircraft.airline ?? unknown}</dd>
            <dt>{t("aircraft.column.lastContact")}</dt>
            <dd className="mono">
              {aircraft.lastContactAt ? Formatter.date(aircraft.lastContactAt) : t("aircraft.never")}
            </dd>
          </dl>
        </Panel>
        <Panel title={t("aircraft.record.position")}>
          {position.length > 0 ? (
            <AircraftMap aircraft={position} />
          ) : (
            <p className={styles.muted}>{t("aircraft.record.noPosition")}</p>
          )}
        </Panel>
      </div>

      <Panel title={t("aircraft.record.flights")}>
        {flights.length === 0 ? (
          <p className={styles.muted}>{t("aircraft.record.noFlight")}</p>
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
                    {flight.inProgress ? t("flight.inProgress") : Formatter.date(flight.endedAt)}
                  </td>
                  <td>
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
                  <td className="mono">{Formatter.number(observation.altitude, "m")}</td>
                  <td className="mono">{Formatter.number(observation.speed, "m/s")}</td>
                  <td className="mono">{Formatter.number(observation.heading, "°")}</td>
                  <td className="mono">
                    {observation.hasPosition
                      ? `${observation.latitude?.toFixed(4)}, ${observation.longitude?.toFixed(4)}`
                      : Formatter.MISSING}
                  </td>
                  <td>{observation.onGround ? t("aircraft.state.ground") : t("aircraft.state.airborne")}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </main>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import AircraftMap from "@/components/map/AircraftMap";
import Notice from "@/components/ui/Notice";
import Panel from "@/components/ui/Panel";
import StatTile from "@/components/ui/StatTile";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/fr";
import type { Observation } from "@/models/Aircraft";
import type { FlightDetail as Flight } from "@/models/Flight";
import { AircraftService } from "@/services/AircraftService";
import { Formatter } from "@/services/Formatter";
import type { MapPosition } from "@/services/MapService";

import styles from "../aircraft/Aircraft.module.css";
import { errorKey } from "../aircraft/errors";
import Profile, { type ProfilePoint } from "./Profile";

function toPosition(point: Observation): MapPosition {
  return { latitude: point.latitude as number, longitude: point.longitude as number, altitude: point.altitude };
}

function profile(points: Observation[], read: (point: Observation) => number | null): ProfilePoint[] {
  return points.flatMap((point) => {
    const value = read(point);
    return value === null ? [] : [{ time: point.lastContactAt.getTime(), value }];
  });
}

export interface FlightDetailProps {
  service?: AircraftService;
}

/** UC-02: the trajectory of a flight on the map, its profiles and its statistics. */
export default function FlightDetail({ service }: FlightDetailProps) {
  const { t } = useTranslation();
  const { flightId = "" } = useParams();
  const api = useMemo(() => service ?? new AircraftService(), [service]);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [error, setError] = useState<TranslationKey | null>(null);

  useEffect(() => {
    let active = true;
    setFlight(null);
    setError(null);
    api
      .flight(flightId)
      .then((detail) => {
        if (active) setFlight(detail);
      })
      .catch((failure: unknown) => {
        if (active) setError(errorKey(failure, "flight.notFound"));
      });
    return () => {
      active = false;
    };
  }, [api, flightId]);

  const segments = useMemo(
    () => (flight ? flight.segments().map((segment) => segment.map(toPosition)) : []),
    [flight],
  );
  const current = useMemo(() => {
    const last = segments.at(-1)?.at(-1);
    return last ? [last] : [];
  }, [segments]);

  const title = <h1>{t("flight.title")}</h1>;

  if (error) {
    return (
      <main className={styles.page}>
        {title}
        <Notice variant="danger">{t(error)}</Notice>
      </main>
    );
  }
  if (!flight) {
    return (
      <main className={styles.page}>
        {title}
        <p role="status" className={styles.muted}>
          {t("aircraft.loading")}
        </p>
      </main>
    );
  }

  const stats = flight.statistics;
  return (
    <main className={styles.page}>
      {title}
      <div>
        <h2 className="mono">{flight.displayName}</h2>
        <p className={styles.subtitle}>
          <Link to={`/aircraft/${flight.aircraftId}`} className="mono">
            {flight.registration ?? flight.icao24}
          </Link>
          {" · "}
          {flight.origin ?? t("flight.unknownOrigin")} → {flight.destination ?? t("flight.unknownDestination")}
          {" · "}
          <span className="mono">
            {Formatter.date(flight.startedAt)} →{" "}
            {flight.inProgress ? t("flight.inProgress") : Formatter.date(flight.endedAt)}
          </span>
        </p>
      </div>

      {flight.isPartial && (
        <Notice variant="warning">
          <p>
            {flight.gaps.length === 1
              ? t("flight.partial.one")
              : t("flight.partial.many", { count: flight.gaps.length })}
          </p>
          <ul className={styles.gaps}>
            {flight.gaps.map((gap) => (
              <li key={gap.start.toISOString()} className="mono">
                {Formatter.date(gap.start)} → {Formatter.date(gap.end)} ({Formatter.duration(gap.durationSeconds)})
              </li>
            ))}
          </ul>
        </Notice>
      )}

      <Panel title={t("flight.trajectory")}>
        {segments.length > 0 ? (
          <AircraftMap aircraft={current} trajectory={segments} />
        ) : (
          <p className={styles.muted}>{t("flight.noPosition")}</p>
        )}
      </Panel>

      <Panel title={t("flight.statistics")}>
        <div className={styles.tiles}>
          <StatTile label={t("flight.stat.duration")} value={Formatter.duration(stats.durationSeconds)} />
          <StatTile label={t("flight.stat.distance")} value={Formatter.number(stats.distanceKm, "km", 1)} />
          <StatTile label={t("flight.stat.meanAltitude")} value={Formatter.number(stats.meanAltitude, "m")} />
          <StatTile label={t("flight.stat.maxAltitude")} value={Formatter.number(stats.maxAltitude, "m")} />
          <StatTile label={t("flight.stat.meanSpeed")} value={Formatter.number(stats.meanSpeed, "m/s")} />
          <StatTile label={t("flight.stat.maxSpeed")} value={Formatter.number(stats.maxSpeed, "m/s")} />
          <StatTile label={t("flight.stat.observations")} value={stats.observationCount} />
        </div>
      </Panel>

      <Panel title={t("flight.profiles")}>
        <div className={styles.profiles}>
          <Profile
            title={t("flight.profile.altitude")}
            unit="m"
            points={profile(flight.trajectory, (p) => p.altitude)}
          />
          <Profile
            title={t("flight.profile.speed")}
            unit="m/s"
            points={profile(flight.trajectory, (p) => p.speed)}
          />
        </div>
      </Panel>
    </main>
  );
}

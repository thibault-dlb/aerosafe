import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import AircraftBanner from "@/components/aircraft/AircraftBanner";
import AircraftMap from "@/components/map/AircraftMap";
import Breadcrumb from "@/components/ui/Breadcrumb";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import Notice from "@/components/ui/Notice";
import Panel from "@/components/ui/Panel";
import Pill from "@/components/ui/Pill";
import StatTile from "@/components/ui/StatTile";
import { usePreferences } from "@/hooks/usePreferences";
import type { TranslationKey } from "@/i18n/fr";
import type { Observation } from "@/models/Aircraft";
import type { FlightDetail as Flight } from "@/models/Flight";
import { AircraftService } from "@/services/AircraftService";
import { Formatter } from "@/services/Formatter";
import type { MapPosition } from "@/services/MapService";
import type { UnitSystem } from "@/services/UnitService";
import { Units } from "@/services/Units";

import { errorKey } from "../aircraft/errors";
import styles from "./FlightDetail.module.css";
import Profile, { type ProfilePoint } from "./Profile";

function toPosition(point: Observation): MapPosition {
  return {
    latitude: point.latitude as number,
    longitude: point.longitude as number,
    altitude: point.altitude,
    heading: point.heading,
    onGround: point.onGround,
  };
}

/** The values of one parameter over the flight, converted to the unit shown, without the missing ones. */
function profile(points: Observation[], read: (point: Observation) => number | null, convert: (value: number) => number): ProfilePoint[] {
  return points.flatMap((point) => {
    const value = read(point);
    return value === null ? [] : [{ time: point.lastContactAt.getTime(), value: convert(value) }];
  });
}

function altitudeUnit(units: UnitSystem): string {
  return Units.altitude(0, units).unit;
}

function speedUnit(units: UnitSystem): string {
  return Units.speed(0, units).unit;
}

export interface FlightDetailProps {
  service?: AircraftService;
}

/** UC-02: the trajectory of a flight on the map, its profiles and its statistics. */
export default function FlightDetail({ service }: FlightDetailProps) {
  const { t, units } = usePreferences();
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
  // The aircraft where the flight ends, turned to its last heading.
  const current = useMemo(() => {
    const last = segments.at(-1)?.at(-1);
    return last ? [last] : [];
  }, [segments]);
  const gaps = useMemo(
    () => (flight ? flight.gaps.map((gap) => ({ start: gap.start.getTime(), end: gap.end.getTime() })) : []),
    [flight],
  );

  const title = <h1 className={styles.title}>{t("flight.title")}</h1>;

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
  const aircraftName = flight.registration ?? flight.icao24.toUpperCase();
  const unknown = t("flight.unknownAirport");
  return (
    <main className={styles.page}>
      <Breadcrumb
        items={[
          { label: t("nav.aircraft"), to: "/aircraft" },
          { label: aircraftName, to: `/aircraft/${flight.aircraftId}` },
          { label: flight.displayName },
        ]}
      />

      <AircraftBanner
        title={flight.displayName}
        subtitle={
          <>
            <Link to={`/aircraft/${flight.aircraftId}`} className="mono">
              {aircraftName}
            </Link>
          </>
        }
        badges={flight.inProgress && <Pill tone="air">{t("flight.pill.inProgress")}</Pill>}
        route={
          <div className={styles.route}>
            <span className="mono">
              {flight.origin ?? unknown} <span className={styles.muted}>{Formatter.date(flight.startedAt)}</span>
            </span>
            <i aria-hidden="true" />
            <Icon name="aircraft" size={20} />
            <i aria-hidden="true" />
            <span className="mono">
              {flight.destination ?? unknown}{" "}
              <span className={styles.muted}>{flight.inProgress ? t("flight.route.arrivalUnknown") : Formatter.date(flight.endedAt)}</span>
            </span>
          </div>
        }
      >
        <StatTile label={t("flight.stat.duration")} value={Formatter.duration(stats.durationSeconds)} />
        <StatTile label={t("flight.stat.distance")} value={Formatter.distance(stats.distanceKm, units)} />
        <StatTile
          label={t("flight.stat.maxAltitude")}
          value={Formatter.altitude(stats.maxAltitude, units)}
          hint={t("flight.stat.meanHint", { value: Formatter.altitude(stats.meanAltitude, units) })}
        />
        <StatTile
          label={t("flight.stat.maxSpeed")}
          value={Formatter.speed(stats.maxSpeed, units)}
          hint={t("flight.stat.meanHint", { value: Formatter.speed(stats.meanSpeed, units) })}
        />
        <StatTile label={t("flight.stat.observations")} value={stats.observationCount} />
      </AircraftBanner>

      {flight.isPartial && (
        <Notice variant="warning">
          <p>
            {flight.gaps.length === 1 ? t("flight.partial.one") : t("flight.partial.many", { count: flight.gaps.length })}
          </p>
          <ul className={styles.gaps}>
            {flight.gaps.map((gap) => (
              <li key={gap.start.toISOString()} className="mono">
                {t("flight.partial.gap", {
                  start: Formatter.date(gap.start),
                  end: Formatter.date(gap.end),
                  duration: Formatter.duration(gap.durationSeconds),
                })}
              </li>
            ))}
          </ul>
        </Notice>
      )}

      <Panel title={t("flight.trajectory")}>
        {segments.length > 0 ? (
          <AircraftMap aircraft={current} trajectory={segments} size="large" label={t("map.label", { count: current.length })} />
        ) : (
          <EmptyState kind="flights" title={t("flight.trajectory")}>
            {t("flight.noPosition")}
          </EmptyState>
        )}
      </Panel>

      <Panel title={t("flight.profiles")}>
        <p className={styles.hint}>{t("flight.profile.hint")}</p>
        <div className={styles.profiles}>
          <Profile
            title={t("flight.profile.altitude")}
            unit={altitudeUnit(units)}
            points={profile(flight.trajectory, (p) => p.altitude, (value) => Units.altitude(value, units).value)}
            gaps={gaps}
          />
          <Profile
            title={t("flight.profile.speed")}
            unit={speedUnit(units)}
            points={profile(flight.trajectory, (p) => p.speed, (value) => Units.speed(value, units).value)}
            gaps={gaps}
          />
        </div>
      </Panel>
    </main>
  );
}

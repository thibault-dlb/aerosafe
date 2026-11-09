import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import AircraftMap from "@/components/map/AircraftMap";
import type { Observation } from "@/models/Aircraft";
import type { FlightDetail as Flight } from "@/models/Flight";
import { errorMessage } from "@/pages/aircraft/errorMessage";
import { formatDate, formatDuration, formatNumber } from "@/pages/aircraft/format";
import { AircraftService } from "@/services/AircraftService";
import type { MapPosition } from "@/services/MapService";

import Profile, { type ProfilePoint } from "./Profile";

function toPosition(point: Observation): MapPosition {
  return { latitude: point.latitude as number, longitude: point.longitude as number };
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
  const { flightId = "" } = useParams();
  const api = useMemo(() => service ?? new AircraftService(), [service]);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        if (active) setError(errorMessage(failure, "This flight does not exist."));
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

  if (error) {
    return (
      <main>
        <h1>Flight</h1>
        <p role="alert">{error}</p>
      </main>
    );
  }
  if (!flight) {
    return (
      <main>
        <h1>Flight</h1>
        <p role="status">Loading…</p>
      </main>
    );
  }

  const stats = flight.statistics;
  return (
    <main>
      <h1>Flight</h1>
      <h2>{flight.displayName}</h2>
      <p>
        <Link to={`/aircraft/${flight.aircraftId}`}>{flight.registration ?? flight.icao24}</Link>
        {" · "}
        {flight.origin ?? "Unknown origin"} → {flight.destination ?? "unknown destination"}
        {" · "}
        {formatDate(flight.startedAt)} → {flight.inProgress ? "in progress" : formatDate(flight.endedAt)}
      </p>

      {flight.isPartial && (
        <div role="note">
          <p>
            The trajectory is partial: {flight.gaps.length} missing segment
            {flight.gaps.length > 1 ? "s" : ""}, not drawn on the map.
          </p>
          <ul>
            {flight.gaps.map((gap) => (
              <li key={gap.start.toISOString()}>
                {formatDate(gap.start)} → {formatDate(gap.end)} ({formatDuration(gap.durationSeconds)})
              </li>
            ))}
          </ul>
        </div>
      )}

      {segments.length > 0 ? (
        <AircraftMap aircraft={current} trajectory={segments} />
      ) : (
        <p>No position recorded for this flight.</p>
      )}

      <section aria-labelledby="statistics-title">
        <h2 id="statistics-title">Statistics</h2>
        <dl>
          <dt>Duration</dt>
          <dd>{formatDuration(stats.durationSeconds)}</dd>
          <dt>Distance</dt>
          <dd>{formatNumber(stats.distanceKm, "km", 1)}</dd>
          <dt>Mean altitude</dt>
          <dd>{formatNumber(stats.meanAltitude, "m")}</dd>
          <dt>Maximum altitude</dt>
          <dd>{formatNumber(stats.maxAltitude, "m")}</dd>
          <dt>Mean speed</dt>
          <dd>{formatNumber(stats.meanSpeed, "m/s")}</dd>
          <dt>Maximum speed</dt>
          <dd>{formatNumber(stats.maxSpeed, "m/s")}</dd>
          <dt>Observations</dt>
          <dd>{stats.observationCount}</dd>
        </dl>
      </section>

      <section aria-labelledby="profiles-title">
        <h2 id="profiles-title">Profiles</h2>
        <Profile title="Altitude" unit="m" points={profile(flight.trajectory, (p) => p.altitude)} />
        <Profile title="Speed" unit="m/s" points={profile(flight.trajectory, (p) => p.speed)} />
      </section>
    </main>
  );
}

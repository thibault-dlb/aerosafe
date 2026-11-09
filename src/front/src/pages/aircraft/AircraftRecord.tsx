import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import AircraftMap from "@/components/map/AircraftMap";
import type { Aircraft, Observation } from "@/models/Aircraft";
import type { Flight } from "@/models/Flight";
import { AircraftService } from "@/services/AircraftService";
import { ErrorMessages } from "@/services/ErrorMessages";
import { Formatter } from "@/services/Formatter";

const ERRORS = ErrorMessages.AIRCRAFT.withNotFound("This aircraft does not exist.");

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
  const { aircraftId = "" } = useParams();
  const api = useMemo(() => service ?? new AircraftService(), [service]);
  const [data, setData] = useState<RecordData | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        if (active) setError(ERRORS.describe(failure));
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
        label: aircraft.displayName,
      },
    ];
  }, [data]);

  if (error) {
    return (
      <main>
        <h1>Aircraft record</h1>
        <p role="alert">{error}</p>
        <Link to="/aircraft">Back to the search</Link>
      </main>
    );
  }
  if (!data) {
    return (
      <main>
        <h1>Aircraft record</h1>
        <p role="status">Loading…</p>
      </main>
    );
  }

  const { aircraft, observations, flights } = data;
  const latestFirst = [...observations].reverse();
  return (
    <main>
      <h1>Aircraft record</h1>
      <h2>{aircraft.displayName}</h2>
      <dl>
        <dt>ICAO24 address</dt>
        <dd>{aircraft.icao24}</dd>
        <dt>Registration</dt>
        <dd>{aircraft.registration ?? "Unknown"}</dd>
        <dt>Model</dt>
        <dd>{aircraft.model ?? "Unknown"}</dd>
        <dt>Airline</dt>
        <dd>{aircraft.airline ?? "Unknown"}</dd>
        <dt>Last contact</dt>
        <dd>{aircraft.lastContactAt ? Formatter.date(aircraft.lastContactAt) : "Never"}</dd>
      </dl>

      {position.length > 0 ? (
        <AircraftMap aircraft={position} />
      ) : (
        <p>No known position.</p>
      )}

      <section aria-labelledby="flights-title">
        <h2 id="flights-title">Flights</h2>
        {flights.length === 0 ? (
          <p>No flight recorded.</p>
        ) : (
          <ul>
            {flights.map((flight) => (
              <li key={flight.id}>
                <Link to={`/flights/${flight.id}`}>{flight.displayName}</Link>{" "}
                {Formatter.date(flight.startedAt)} → {flight.inProgress ? "in progress" : Formatter.date(flight.endedAt)}
                {flight.origin || flight.destination
                  ? ` (${flight.origin ?? "?"} → ${flight.destination ?? "?"})`
                  : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="history-title">
        <h2 id="history-title">Flight parameters</h2>
        {observations.length === 0 ? (
          <p>No observation recorded.</p>
        ) : (
          <table>
            <caption>Latest {observations.length} observations, newest first</caption>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Altitude</th>
                <th scope="col">Speed</th>
                <th scope="col">Heading</th>
                <th scope="col">Position</th>
                <th scope="col">State</th>
              </tr>
            </thead>
            <tbody>
              {latestFirst.map((observation) => (
                <tr key={observation.lastContactAt.toISOString()}>
                  <td>{Formatter.date(observation.lastContactAt)}</td>
                  <td>{Formatter.number(observation.altitude, "m")}</td>
                  <td>{Formatter.number(observation.speed, "m/s")}</td>
                  <td>{Formatter.number(observation.heading, "°")}</td>
                  <td>
                    {observation.hasPosition
                      ? `${observation.latitude?.toFixed(4)}, ${observation.longitude?.toFixed(4)}`
                      : "–"}
                  </td>
                  <td>{observation.onGround ? "On ground" : "Airborne"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

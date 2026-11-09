import { type FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import AircraftMap from "@/components/map/AircraftMap";
import type { Aircraft } from "@/models/Aircraft";
import { type AircraftSearch as Criteria, AircraftService } from "@/services/AircraftService";
import { ErrorMessages } from "@/services/ErrorMessages";
import type { MapPosition } from "@/services/MapService";

import { AREA_FIELDS, type AreaField, parseArea } from "./area";

export interface AircraftSearchProps {
  service?: AircraftService;
}

/** UC-01: search aircraft by address, registration, airline or area, and pick one. */
export default function AircraftSearch({ service }: AircraftSearchProps) {
  const api = useMemo(() => service ?? new AircraftService(), [service]);
  const [icao24, setIcao24] = useState("");
  const [registration, setRegistration] = useState("");
  const [airline, setAirline] = useState("");
  const [bounds, setBounds] = useState<Record<AreaField, string>>({
    south: "",
    west: "",
    north: "",
    east: "",
  });
  const [results, setResults] = useState<Aircraft[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const positions = useMemo<MapPosition[]>(
    () =>
      (results ?? [])
        .filter((aircraft) => aircraft.hasPosition)
        .map((aircraft) => ({
          latitude: aircraft.latitude as number,
          longitude: aircraft.longitude as number,
          label: aircraft.displayName,
        })),
    [results],
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const area = parseArea(bounds);
    if (area === null) {
      setError("An area needs the four bounds: south, west, north and east.");
      return;
    }
    const criteria: Criteria = { icao24, registration, airline, area };
    setLoading(true);
    setError(null);
    try {
      setResults(await api.search(criteria));
    } catch (failure) {
      setResults(null);
      setError(ErrorMessages.AIRCRAFT.describe(failure));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>Aircraft search</h1>
      <form onSubmit={onSubmit} aria-label="Aircraft search">
        <label>
          ICAO24 address
          <input
            value={icao24}
            onChange={(event) => setIcao24(event.target.value)}
            pattern="[0-9a-fA-F]{1,6}"
            maxLength={6}
            placeholder="3c6444"
          />
        </label>
        <label>
          Registration
          <input
            value={registration}
            onChange={(event) => setRegistration(event.target.value)}
            maxLength={20}
            placeholder="F-GKXA"
          />
        </label>
        <label>
          Airline
          <input
            value={airline}
            onChange={(event) => setAirline(event.target.value)}
            maxLength={100}
            placeholder="Air France"
          />
        </label>
        <fieldset>
          <legend>Area (optional, in degrees)</legend>
          {AREA_FIELDS.map((field) => (
            <label key={field}>
              {field[0].toUpperCase() + field.slice(1)}
              <input
                type="number"
                step="any"
                value={bounds[field]}
                onChange={(event) => setBounds({ ...bounds, [field]: event.target.value })}
              />
            </label>
          ))}
        </fieldset>
        <button type="submit" disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && <p role="alert">{error}</p>}

      {results !== null && results.length === 0 && (
        <p role="status">No aircraft matches these criteria. Try broader criteria.</p>
      )}

      {results !== null && results.length > 0 && (
        <>
          <table>
            <caption>{results.length} aircraft found</caption>
            <thead>
              <tr>
                <th scope="col">Aircraft</th>
                <th scope="col">ICAO24</th>
                <th scope="col">Model</th>
                <th scope="col">Airline</th>
                <th scope="col">Last contact</th>
              </tr>
            </thead>
            <tbody>
              {results.map((aircraft) => (
                <tr key={aircraft.id}>
                  <td>
                    <Link to={`/aircraft/${aircraft.id}`}>{aircraft.displayName}</Link>
                  </td>
                  <td>{aircraft.icao24}</td>
                  <td>{aircraft.model ?? "Unknown"}</td>
                  <td>{aircraft.airline ?? "Unknown"}</td>
                  <td>{aircraft.lastContactAt?.toLocaleString() ?? "Never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <AircraftMap aircraft={positions} />
        </>
      )}
    </main>
  );
}

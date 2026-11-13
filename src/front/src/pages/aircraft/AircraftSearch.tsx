import { type FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import AircraftMap from "@/components/map/AircraftMap";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import Notice from "@/components/ui/Notice";
import Panel from "@/components/ui/Panel";
import Table from "@/components/ui/Table";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/fr";
import type { Aircraft } from "@/models/Aircraft";
import { type AircraftSearch as Criteria, AircraftService } from "@/services/AircraftService";
import { Formatter } from "@/services/Formatter";
import type { MapPosition } from "@/services/MapService";

import styles from "./Aircraft.module.css";
import { AREA_FIELDS, type AreaField, parseArea } from "./area";
import { errorKey } from "./errors";

const AREA_LABELS: Record<AreaField, TranslationKey> = {
  south: "aircraft.search.south",
  west: "aircraft.search.west",
  north: "aircraft.search.north",
  east: "aircraft.search.east",
};

export interface AircraftSearchProps {
  service?: AircraftService;
}

/** UC-01: search aircraft by address, registration, airline or area, and pick one. */
export default function AircraftSearch({ service }: AircraftSearchProps) {
  const { t } = useTranslation();
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
  const [error, setError] = useState<TranslationKey | null>(null);
  const [loading, setLoading] = useState(false);

  const positions = useMemo<MapPosition[]>(
    () =>
      (results ?? [])
        .filter((aircraft) => aircraft.hasPosition)
        .map((aircraft) => ({
          latitude: aircraft.latitude as number,
          longitude: aircraft.longitude as number,
          altitude: aircraft.altitude,
          label: aircraft.displayName,
        })),
    [results],
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const area = parseArea(bounds);
    if (area === null) {
      setError("aircraft.search.incompleteArea");
      return;
    }
    const criteria: Criteria = { icao24, registration, airline, area };
    setLoading(true);
    setError(null);
    try {
      setResults(await api.search(criteria));
    } catch (failure) {
      setResults(null);
      setError(errorKey(failure, "aircraft.error.criteria"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <h1>{t("aircraft.search.title")}</h1>
      <Panel title={t("aircraft.search.criteria")}>
        <form onSubmit={onSubmit} aria-label={t("aircraft.search.title")} className={styles.form}>
          <div className={styles.fields}>
            <Field
              label={t("aircraft.search.icao24")}
              value={icao24}
              onChange={(event) => setIcao24(event.target.value)}
              pattern="[0-9a-fA-F]{1,6}"
              maxLength={6}
              placeholder="3c6444"
              className="mono"
            />
            <Field
              label={t("aircraft.search.registration")}
              value={registration}
              onChange={(event) => setRegistration(event.target.value)}
              maxLength={20}
              placeholder="F-GKXA"
              className="mono"
            />
            <Field
              label={t("aircraft.search.airline")}
              value={airline}
              onChange={(event) => setAirline(event.target.value)}
              maxLength={100}
              placeholder="Air France"
            />
          </div>
          <fieldset className={styles.area}>
            <legend>{t("aircraft.search.area")}</legend>
            <div className={styles.fields}>
              {AREA_FIELDS.map((field) => (
                <Field
                  key={field}
                  label={t(AREA_LABELS[field])}
                  type="number"
                  step="any"
                  value={bounds[field]}
                  onChange={(event) => setBounds({ ...bounds, [field]: event.target.value })}
                  className="mono"
                />
              ))}
            </div>
          </fieldset>
          <div>
            <Button type="submit" disabled={loading}>
              {loading ? t("aircraft.search.searching") : t("aircraft.search.submit")}
            </Button>
          </div>
        </form>
      </Panel>

      {error && <Notice variant="danger">{t(error)}</Notice>}

      {results !== null && results.length === 0 && <Notice>{t("aircraft.search.empty")}</Notice>}

      {results !== null && results.length > 0 && (
        <div className={styles.results}>
          <Table>
            <caption>{t("aircraft.search.found", { count: results.length })}</caption>
            <thead>
              <tr>
                <th scope="col">{t("aircraft.column.aircraft")}</th>
                <th scope="col">{t("aircraft.column.icao24")}</th>
                <th scope="col">{t("aircraft.column.model")}</th>
                <th scope="col">{t("aircraft.column.airline")}</th>
                <th scope="col">{t("aircraft.column.lastContact")}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((aircraft) => (
                <tr key={aircraft.id}>
                  <td>
                    <Link to={`/aircraft/${aircraft.id}`} className="mono">
                      {aircraft.displayName}
                    </Link>
                  </td>
                  <td className="mono">{aircraft.icao24}</td>
                  <td>{aircraft.model ?? t("aircraft.unknown")}</td>
                  <td>{aircraft.airline ?? t("aircraft.unknown")}</td>
                  <td className="mono">
                    {aircraft.lastContactAt ? Formatter.date(aircraft.lastContactAt) : t("aircraft.never")}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <AircraftMap aircraft={positions} />
        </div>
      )}
    </main>
  );
}

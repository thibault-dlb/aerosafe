import { type FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import AircraftGlyph from "@/components/aircraft/AircraftGlyph";
import AircraftMap from "@/components/map/AircraftMap";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import Notice from "@/components/ui/Notice";
import { usePreferences } from "@/hooks/usePreferences";
import type { TranslationKey } from "@/i18n/fr";
import type { Aircraft } from "@/models/Aircraft";
import { AircraftQuery } from "@/services/AircraftQuery";
import { type Area, AircraftService } from "@/services/AircraftService";
import { Formatter } from "@/services/Formatter";
import type { MapPosition } from "@/services/MapService";

import styles from "./AircraftSearch.module.css";
import { errorKey } from "./errors";

const KIND_LABELS = {
  icao24: "aircraft.search.kind.icao24",
  registration: "aircraft.search.kind.registration",
  airline: "aircraft.search.kind.airline",
} as const satisfies Record<string, TranslationKey>;

export interface AircraftSearchProps {
  service?: AircraftService;
}

/** UC-01: search aircraft by address, registration or airline, and by an area drawn on the map. */
export default function AircraftSearch({ service }: AircraftSearchProps) {
  const { t, units } = usePreferences();
  const api = useMemo(() => service ?? new AircraftService(), [service]);
  const [text, setText] = useState("");
  const [area, setArea] = useState<Area | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [results, setResults] = useState<Aircraft[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [loading, setLoading] = useState(false);

  const parsed = AircraftQuery.parse(text);

  async function search(searchArea: Area | null) {
    setLoading(true);
    setError(null);
    try {
      setResults(await api.search({ ...AircraftQuery.parse(text).criteria, area: searchArea ?? undefined }));
      setSelectedId(null);
    } catch (failure) {
      setResults(null);
      setError(errorKey(failure, "aircraft.error.criteria"));
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void search(area);
  }

  function onAreaDrawn(drawn: Area) {
    setArea(drawn);
    setDrawing(false);
    void search(drawn);
  }

  function removeArea() {
    setArea(null);
    if (results !== null) void search(null);
  }

  const positions = useMemo<MapPosition[]>(
    () =>
      (results ?? [])
        .filter((aircraft) => aircraft.hasPosition)
        .map((aircraft) => ({
          latitude: aircraft.latitude as number,
          longitude: aircraft.longitude as number,
          altitude: aircraft.altitude,
          heading: aircraft.heading,
          onGround: aircraft.onGround,
          label: aircraft.displayName,
          selected: aircraft.id === selectedId,
        })),
    [results, selectedId],
  );

  const count = results?.length ?? 0;

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{t("aircraft.search.title")}</h1>

      <form className={styles.bar} onSubmit={onSubmit} aria-label={t("aircraft.search.title")}>
        <label className={styles.input}>
          <Icon name="search" size={18} />
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-label={t("aircraft.search.field")}
            placeholder={t("aircraft.search.placeholder")}
            maxLength={100}
            autoComplete="off"
          />
        </label>
        <Button variant="secondary" aria-pressed={drawing} onClick={() => setDrawing((on) => !on)}>
          <Icon name="area" size={16} />
          {t(drawing ? "aircraft.search.stopDrawing" : "aircraft.search.drawArea")}
        </Button>
        <Button type="submit" disabled={loading}>
          {t("aircraft.search.go")}
        </Button>
      </form>

      <div className={styles.hints}>
        {parsed.kind ? (
          <>
            <span>{t("aircraft.search.understood")}</span>
            <Chip pressed={false} disabled>
              {t(KIND_LABELS[parsed.kind], { text: parsed.text })}
            </Chip>
          </>
        ) : (
          <span>
            {t("aircraft.search.examples")} <span className="mono">3c6444</span> · <span className="mono">F-GKXA</span> · Air France
          </span>
        )}
        {area && (
          <span className={styles.areaChip}>
            <Icon name="area" size={14} />
            {t("aircraft.search.areaChip", {
              south: area.south.toFixed(1),
              north: area.north.toFixed(1),
              west: area.west.toFixed(1),
              east: area.east.toFixed(1),
            })}
            <button type="button" className={styles.remove} aria-label={t("aircraft.search.removeArea")} onClick={removeArea}>
              <Icon name="close" size={14} />
            </button>
          </span>
        )}
      </div>

      {error && <Notice variant="danger">{t(error)}</Notice>}

      <div className={styles.split}>
        <section className={styles.results} aria-label={t("aircraft.search.results")}>
          <header className={styles.resultsHead}>
            <h2>{results === null ? t("aircraft.search.results") : t(count === 1 ? "aircraft.search.found.one" : "aircraft.search.found.many", { count })}</h2>
          </header>
          {results === null && <p className={styles.prompt}>{loading ? t("aircraft.loading") : t("aircraft.search.prompt")}</p>}
          {results !== null && results.length === 0 && (
            <EmptyState kind="results" title={t("aircraft.search.empty.title")}>
              {t("aircraft.search.empty.text")}
            </EmptyState>
          )}
          {results !== null && results.length > 0 && (
            <ul className={styles.list}>
              {results.map((aircraft) => (
                <li key={aircraft.id}>
                  <Link
                    to={`/aircraft/${aircraft.id}`}
                    className={[styles.row, aircraft.id === selectedId && styles.selected].filter(Boolean).join(" ")}
                    onMouseEnter={() => setSelectedId(aircraft.id)}
                    onFocus={() => setSelectedId(aircraft.id)}
                  >
                    <AircraftGlyph heading={aircraft.heading} onGround={aircraft.onGround} altitude={aircraft.altitude} />
                    <span className={styles.name}>{aircraft.displayName}</span>
                    <span className={styles.altitude}>
                      {aircraft.onGround ? t("aircraft.state.ground") : Formatter.altitude(aircraft.altitude, units)}
                    </span>
                    <span className={styles.meta}>
                      {aircraft.model ?? t("aircraft.unknown")} · {aircraft.airline ?? t("aircraft.unknown")}
                    </span>
                    <span className={styles.seen}>
                      {aircraft.lastContactAt ? Formatter.date(aircraft.lastContactAt) : t("aircraft.never")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className={styles.map}>
          <AircraftMap
            aircraft={positions}
            area={area}
            selectingArea={drawing}
            onAreaDrawn={onAreaDrawn}
            label={t("map.label", { count: positions.length })}
          />
          {drawing && <p className={styles.drawingHint}>{t("aircraft.search.drawingHint")}</p>}
        </div>
      </div>
    </main>
  );
}

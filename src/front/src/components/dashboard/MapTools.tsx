import { type FormEvent, type ReactNode, useId, useMemo, useState } from "react";

import { usePreferences } from "@/hooks/usePreferences";
import type { Aircraft } from "@/models/Aircraft";

import styles from "./MapTools.module.css";

export interface MapToolsProps {
  fullscreen: boolean;
  onRecenter: () => void;
  onFullscreen: () => void;
  onZoom: (levels: number) => void;
}

const ZOOM_STEP = 0.75;

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** The buttons on the side of the map: recentre, full screen, zoom. */
export function MapTools({ fullscreen, onRecenter, onFullscreen, onZoom }: MapToolsProps) {
  const { t } = usePreferences();
  return (
    <div className={styles.tools}>
      <button type="button" onClick={onRecenter} aria-label={t("dashboard.map.recenter")} title={t("dashboard.map.recenter")}>
        <Glyph>
          <circle cx="12" cy="12" r="6.5" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" />
          <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
        </Glyph>
      </button>
      <button
        type="button"
        onClick={onFullscreen}
        aria-pressed={fullscreen}
        aria-label={fullscreen ? t("dashboard.map.exitFullscreen") : t("dashboard.map.fullscreen")}
        title={fullscreen ? t("dashboard.map.exitFullscreen") : t("dashboard.map.fullscreen")}
      >
        <Glyph>{fullscreen ? <path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" /> : <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />}</Glyph>
      </button>
      <button type="button" onClick={() => onZoom(ZOOM_STEP)} aria-label={t("dashboard.map.zoomIn")} title={t("dashboard.map.zoomIn")}>
        <Glyph>
          <path d="M12 5v14M5 12h14" />
        </Glyph>
      </button>
      <button type="button" onClick={() => onZoom(-ZOOM_STEP)} aria-label={t("dashboard.map.zoomOut")} title={t("dashboard.map.zoomOut")}>
        <Glyph>
          <path d="M5 12h14" />
        </Glyph>
      </button>
    </div>
  );
}

export interface FindAircraftProps {
  aircraft: Aircraft[];
  /** The aircraft the user named. */
  onFind: (aircraft: Aircraft) => void;
}

/** How many suggestions the list shows. */
export const SUGGESTIONS = 12;

/** Looks an aircraft up by registration or ICAO24 and follows it: the keyboard's way to what a click does. */
export function FindAircraft({ aircraft, onFind }: FindAircraftProps) {
  const { t } = usePreferences();
  const listId = useId();
  const [text, setText] = useState("");
  const [missing, setMissing] = useState(false);
  const wanted = text.trim().toLowerCase();

  const suggestions = useMemo(() => {
    if (wanted.length === 0) return [];
    return aircraft
      .filter((item) => item.displayName.toLowerCase().startsWith(wanted) || item.icao24.startsWith(wanted))
      .slice(0, SUGGESTIONS);
  }, [aircraft, wanted]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = aircraft.find((item) => item.displayName.toLowerCase() === wanted || item.icao24 === wanted);
    if (found) {
      setText("");
      setMissing(false);
      onFind(found);
    } else {
      setMissing(wanted.length > 0);
    }
  }

  return (
    <form className={styles.find} onSubmit={submit} role="search">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="11" cy="11" r="6" />
        <path d="M16 16l4 4" />
      </svg>
      <input
        type="search"
        value={text}
        list={listId}
        onChange={(event) => {
          setText(event.target.value);
          setMissing(false);
        }}
        placeholder={t("dashboard.map.find")}
        aria-label={t("dashboard.map.find")}
        autoComplete="off"
        spellCheck={false}
      />
      <datalist id={listId}>
        {suggestions.map((item) => (
          <option key={item.id} value={item.displayName} />
        ))}
      </datalist>
      {missing && (
        <span role="status" className={styles.missing}>
          {t("dashboard.map.find.none")}
        </span>
      )}
    </form>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import CriticalityMark from "@/components/ui/CriticalityMark";
import { usePreferences } from "@/hooks/usePreferences";
import type { Aircraft } from "@/models/Aircraft";
import type { Alert } from "@/models/Alert";
import type { FlightPoint, TrackedSnapshot } from "@/models/Traffic";
import { Formatter } from "@/services/Formatter";
import { TrackedFormat } from "@/services/TrackedFormat";
import { RuleLabels } from "@/services/RuleLabels";

import styles from "./TrackedAircraft.module.css";

/** Time between two readings of the map by the card. */
export const CARD_REFRESH_MS = 500;
const PROFILE_WIDTH = 300;
const PROFILE_HEIGHT = 64;

export interface TrackedAircraftProps {
  aircraft: Aircraft;
  /** Reads the aircraft from the map: its estimated place, the age of its last report. */
  describe: (id: string) => TrackedSnapshot | null;
  /** The most critical active alert of the aircraft, if it has one. */
  alert: Alert | null;
  /** Everything known of its flight, for the profile of its altitude. */
  history: FlightPoint[];
  following: boolean;
  onFollow: (following: boolean) => void;
  onClose: () => void;
  /** The link to the page of the aircraft. A previewed aircraft is not in the base: it has no page. */
  detailLink?: boolean;
}

/**
 * The card of the aircraft that is followed on the map, read again twice a second: where it is,
 * how high and how fast, when it was last heard, its active alert and the profile of its altitude
 * over the whole flight known. Its place is an estimate between two reports.
 */
export default function TrackedAircraft({
  aircraft,
  describe,
  alert,
  history,
  following,
  onFollow,
  onClose,
  detailLink = true,
}: TrackedAircraftProps) {
  const { t, units } = usePreferences();
  const [snapshot, setSnapshot] = useState<TrackedSnapshot | null>(() => describe(aircraft.id));

  useEffect(() => {
    setSnapshot(describe(aircraft.id));
    const timer = setInterval(() => setSnapshot(describe(aircraft.id)), CARD_REFRESH_MS);
    return () => clearInterval(timer);
  }, [aircraft.id, describe]);

  const profile = TrackedFormat.profile(history, PROFILE_WIDTH, PROFILE_HEIGHT);
  const identity = [aircraft.icao24.toUpperCase(), aircraft.model, aircraft.airline].filter(Boolean).join(" · ");
  const age = snapshot ? Formatter.duration(snapshot.age / 1000) : null;

  return (
    <section className={styles.card} aria-label={t("dashboard.track.title")}>
      <header className={styles.head}>
        <h2 className={`${styles.name} mono`}>{aircraft.displayName}</h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label={t("dashboard.track.close")}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>
      <p className={styles.identity}>{identity}</p>
      {alert && (
        <p className={styles.alert}>
          <CriticalityMark level={alert.criticality} />
          <span>
            <strong>{alert.ruleCode}</strong> · {RuleLabels.name(alert.ruleCode, alert.ruleDescription, t)}
          </span>
        </p>
      )}
      {snapshot && (
        <dl className={styles.values}>
          <div>
            <dt>{t("dashboard.track.altitude")}</dt>
            <dd className="mono">{snapshot.onGround ? t("dashboard.track.ground") : Formatter.altitude(snapshot.altitude, units)}</dd>
          </div>
          <div>
            <dt>{t("dashboard.track.speed")}</dt>
            <dd className="mono">{Formatter.speed(snapshot.speed, units)}</dd>
          </div>
          <div>
            <dt>{t("dashboard.track.heading")}</dt>
            <dd className="mono">{snapshot.heading === null ? Formatter.MISSING : `${String(Math.round(snapshot.heading)).padStart(3, "0")}°`}</dd>
          </div>
          <div>
            <dt>{t("dashboard.track.age")}</dt>
            <dd className={`mono ${snapshot.silent ? styles.silent : ""}`}>
              {snapshot.silent ? t("dashboard.track.silent", { time: age ?? "" }) : t("dashboard.track.ageValue", { time: age ?? "" })}
            </dd>
          </div>
          <div className={styles.wide}>
            <dt>
              {t("dashboard.track.position")} <span className={styles.hint}>{t("dashboard.track.estimate")}</span>
            </dt>
            <dd className="mono">{TrackedFormat.coordinates(snapshot.lat, snapshot.lon)}</dd>
          </div>
        </dl>
      )}
      <div className={styles.profile}>
        <span className={styles.caption}>{t("dashboard.track.profile")}</span>
        {profile ? (
          <svg
            viewBox={`0 0 ${PROFILE_WIDTH} ${PROFILE_HEIGHT}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={t("dashboard.track.profile.label", { count: history.length, peak: Formatter.altitude(profile.peak, units) })}
          >
            <polygon points={`0,${PROFILE_HEIGHT} ${profile.line} ${PROFILE_WIDTH},${PROFILE_HEIGHT}`} className={styles.area} />
            <polyline points={profile.line} className={styles.curve} vectorEffect="non-scaling-stroke" />
          </svg>
        ) : (
          <p className={styles.hint}>{t("dashboard.track.profile.none")}</p>
        )}
      </div>
      <footer className={styles.foot}>
        {detailLink ? <Link to={`/aircraft/${aircraft.id}`}>{t("dashboard.track.open")}</Link> : <span />}
        <button type="button" aria-pressed={following} onClick={() => onFollow(!following)}>
          {following ? t("dashboard.track.following") : t("dashboard.track.follow")}
        </button>
      </footer>
    </section>
  );
}

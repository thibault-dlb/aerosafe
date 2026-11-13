import { useTranslation } from "@/hooks/useTranslation";
import { type FlightFrame, FlightTimeline } from "@/services/FlightTimeline";

import styles from "./FlightHud.module.css";

const PROFILE_WIDTH = 220;
const PROFILE_HEIGHT = 52;
const PROFILE_SAMPLES = 110;

function profilePoint(flight: number, altitude: number): string {
  const x = flight * PROFILE_WIDTH;
  const y = PROFILE_HEIGHT - 4 - (altitude / FlightTimeline.CRUISE_ALTITUDE) * (PROFILE_HEIGHT - 10);
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}

export interface FlightHudProps {
  frame: FlightFrame;
  timeline: FlightTimeline;
  callsign: string;
  /** Departure and arrival, as ICAO codes. */
  route: string;
}

/** Readings of the aircraft of the scene: altitude, rates, heading, then the alert of rule R3. */
export default function FlightHud({ frame, timeline, callsign, route }: FlightHudProps) {
  const { t, language } = useTranslation();
  const number = new Intl.NumberFormat(language, { maximumFractionDigits: 0 });
  const signed = new Intl.NumberFormat(language, { maximumFractionDigits: 0, signDisplay: "exceptZero" });

  const flown: string[] = [];
  for (let sample = 0; sample <= PROFILE_SAMPLES; sample += 1) {
    const flight = sample / PROFILE_SAMPLES;
    if (flight > frame.flight) break;
    flown.push(profilePoint(flight, timeline.altitude(flight)));
  }
  flown.push(profilePoint(frame.flight, frame.altitude));

  return (
    <aside
      className={`${styles.hud} ${frame.alert ? styles.alerting : ""}`}
      style={{ opacity: frame.hudOpacity, visibility: frame.hudOpacity > 0 ? "visible" : "hidden" }}
      aria-hidden="true"
    >
      <header className={styles.head}>
        <span className={styles.callsign}>{callsign}</span>
        <span className={styles.route}>{route}</span>
        <span className={styles.status}>{frame.alert ? t("home.hud.alert") : t("home.hud.nominal")}</span>
      </header>

      <dl className={styles.readings}>
        <div>
          <dt>{t("home.hud.altitude")}</dt>
          <dd>
            {number.format(frame.altitude)} <small>m</small>
          </dd>
        </div>
        <div className={styles.watched}>
          <dt>{t("home.hud.verticalRate")}</dt>
          <dd>
            {signed.format(frame.verticalRate)} <small>m/s</small>
          </dd>
        </div>
        <div>
          <dt>{t("home.hud.speed")}</dt>
          <dd>
            {number.format(frame.speed * 3.6)} <small>km/h</small>
          </dd>
        </div>
        <div>
          <dt>{t("home.hud.heading")}</dt>
          <dd>
            {number.format(frame.heading).padStart(3, "0")}
            <small>°</small>
          </dd>
        </div>
      </dl>

      <svg className={styles.profile} viewBox={`0 0 ${PROFILE_WIDTH} ${PROFILE_HEIGHT}`}>
        <line className={styles.baseline} x1={0} y1={PROFILE_HEIGHT - 4} x2={PROFILE_WIDTH} y2={PROFILE_HEIGHT - 4} />
        <polyline className={styles.curve} points={flown.join(" ")} />
      </svg>

      <div className={styles.alert} style={{ opacity: frame.alertOpacity }}>
        <strong>{t("home.hud.alertTitle")}</strong>
        <span>
          {t("home.hud.alertDetail", {
            rate: signed.format(FlightTimeline.DROP_RATE),
            threshold: number.format(FlightTimeline.R3_THRESHOLD),
          })}
        </span>
      </div>
    </aside>
  );
}

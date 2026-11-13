import { useMemo, useRef } from "react";

import { ButtonLink } from "@/components/ui/Button";
import { useScrollProgress } from "@/hooks/useScrollProgress";
import { useTranslation } from "@/hooks/useTranslation";
import { FlightRoute } from "@/services/FlightRoute";
import { FlightTimeline } from "@/services/FlightTimeline";

import FlightHud from "./FlightHud";
import FlightScene from "./FlightScene";
import styles from "./HomeHero.module.css";
import { ROUTE_WAYPOINTS, SceneProjection } from "./sceneGeography";

/** Invented callsign and the real ICAO codes of the two airports of the scene. */
const CALLSIGN = "ASF2041";
const ROUTE_CODES = "LFPG → LFMN";

/**
 * Top of the home page. It stays in the window while the page scrolls through it, and the
 * scroll plays the scene: the title leaves, an aircraft crosses France, an alert is raised.
 */
export default function HomeHero() {
  const { t } = useTranslation();
  const section = useRef<HTMLElement>(null);
  const progress = useScrollProgress(section);

  const { timeline, routePath } = useMemo(() => {
    const route = new FlightRoute(ROUTE_WAYPOINTS);
    return {
      timeline: new FlightTimeline(route, SceneProjection.CENTER),
      routePath: FlightRoute.toPath(route.slice(0, 1)),
    };
  }, []);
  const frame = timeline.frame(progress);

  function layer(opacity: number, shift = 0) {
    return {
      opacity,
      visibility: opacity > 0.01 ? ("visible" as const) : ("hidden" as const),
      transform: shift ? `translateY(${shift}px)` : undefined,
    };
  }

  return (
    <section ref={section} className={styles.hero} aria-labelledby="home-title">
      <div className={styles.stage}>
        <FlightScene frame={frame} routePath={routePath} callsign={CALLSIGN} label={t("home.scene.label")} />
        <div className={styles.vignette} />

        <div className={styles.intro} style={layer(frame.introOpacity, (frame.introOpacity - 1) * 60)}>
          <p className={styles.eyebrow}>{t("home.eyebrow")}</p>
          <h1 id="home-title" className={styles.title}>
            AeroSafe
          </h1>
          <p className={styles.tagline}>{t("home.tagline")}</p>
          <div className={styles.actions}>
            <ButtonLink to="/dashboard">{t("home.cta.dashboard")}</ButtonLink>
            <ButtonLink to="/login" variant="secondary">
              {t("home.cta.login")}
            </ButtonLink>
          </div>
        </div>

        <div className={styles.caption} style={layer(frame.trackCaptionOpacity, (1 - frame.trackCaptionOpacity) * 24)}>
          <h2>{t("home.scene.track.title")}</h2>
          <p>{t("home.scene.track.text")}</p>
        </div>
        <div
          className={`${styles.caption} ${styles.captionAlert}`}
          style={layer(frame.detectCaptionOpacity, (1 - frame.detectCaptionOpacity) * 24)}
        >
          <h2>{t("home.scene.detect.title")}</h2>
          <p>{t("home.scene.detect.text")}</p>
        </div>

        <FlightHud frame={frame} timeline={timeline} callsign={CALLSIGN} route={ROUTE_CODES} />

        <p className={styles.hint} style={layer(frame.hintOpacity)} aria-hidden="true">
          {t("home.scroll")}
          <span />
        </p>
      </div>
    </section>
  );
}

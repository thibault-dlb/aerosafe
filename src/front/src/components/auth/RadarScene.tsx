import { useEffect, useRef } from "react";

import { CITIES, CORSICA, MAINLAND, RADAR, SceneProjection } from "@/components/home/sceneGeography";
import { useTranslation } from "@/hooks/useTranslation";
import { FlightRoute } from "@/services/FlightRoute";
import { RadarFlights } from "@/services/RadarFlights";

import styles from "./RadarScene.module.css";

const LAND_PATH = `${FlightRoute.toPath(SceneProjection.points(MAINLAND))}Z${FlightRoute.toPath(SceneProjection.points(CORSICA))}Z`;

/** Meridians and parallels, one per degree, far beyond the country so they fill wide screens. */
const GRATICULE = (() => {
  const lines: string[] = [];
  for (let longitude = -30; longitude <= 35; longitude += 1) {
    lines.push(FlightRoute.toPath([SceneProjection.point(longitude, 62), SceneProjection.point(longitude, 32)]));
  }
  for (let latitude = 32; latitude <= 62; latitude += 1) {
    lines.push(FlightRoute.toPath([SceneProjection.point(-30, latitude), SceneProjection.point(35, latitude)]));
  }
  return lines.join("");
})();

const RINGS = [90, 180, 270, 360, 450, 540, 630, 720];
const REACH = 900;

/** A slice of the radar disc that ends at the north, on the bright line, and trails `degrees` behind it. */
function wedge(degrees: number): string {
  const angle = (degrees * Math.PI) / 180;
  const x = -Math.sin(angle) * REACH;
  const y = -Math.cos(angle) * REACH;
  return `M0 0L${x.toFixed(1)} ${y.toFixed(1)}A${REACH} ${REACH} 0 0 1 0 ${-REACH}Z`;
}

const PLANE_PATH =
  "M0 -13L2.6 -4.5L12 2.5L12 5L2.6 2.2L2 8.5L5.2 11L5.2 12.6L0 11.4L-5.2 12.6L-5.2 11L-2 8.5L-2.6 2.2L-12 5L-12 2.5L-2.6 -4.5Z";

function prefersLessMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/**
 * The radar of the log in screen: France, the beam that sweeps it and a few aircraft. It moves
 * by itself, whatever the page does around it, and keeps running when the screen swaps panels.
 * With reduced motion asked for, it is a still picture.
 */
export default function RadarScene() {
  const { t } = useTranslation();
  const beam = useRef<SVGGElement>(null);
  const planes = useRef<(SVGGElement | null)[]>([]);

  useEffect(() => {
    function draw(seconds: number) {
      const frame = RadarFlights.frame(seconds);
      beam.current?.setAttribute("transform", `rotate(${frame.beamDegrees.toFixed(2)})`);
      frame.planes.forEach((plane, index) => {
        const group = planes.current[index];
        if (!group) return;
        group.setAttribute("transform", `translate(${plane.x.toFixed(1)} ${plane.y.toFixed(1)})`);
        group.style.opacity = plane.opacity.toFixed(2);
        group.querySelector("[data-glyph]")?.setAttribute("transform", `rotate(${plane.heading.toFixed(1)}) scale(1.15)`);
        const lead = group.querySelector("[data-lead]");
        lead?.setAttribute("x2", plane.leadX.toFixed(1));
        lead?.setAttribute("y2", plane.leadY.toFixed(1));
        const echo = group.querySelector<SVGElement>("[data-echo]");
        echo?.setAttribute("r", plane.echoRadius.toFixed(1));
        if (echo) echo.style.opacity = plane.echoOpacity.toFixed(2);
      });
    }

    if (prefersLessMotion()) {
      draw(RadarFlights.STILL_SECONDS);
      return;
    }
    let frameId = 0;
    const start = performance.now();
    const tick = (now: number) => {
      draw((now - start) / 1000 + RadarFlights.STILL_SECONDS);
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className={styles.radar}>
      <svg viewBox="40 0 920 980" preserveAspectRatio="xMidYMid slice" role="img" aria-label={t("auth.radar.label")}>
        <path className={styles.graticule} d={GRATICULE} />
        <g transform={`translate(${RADAR.x} ${RADAR.y})`}>
          {RINGS.map((radius) => (
            <circle key={radius} className={styles.ring} r={radius} />
          ))}
          <g ref={beam} className={styles.beam}>
            <path d={wedge(52)} opacity={0.05} />
            <path d={wedge(28)} opacity={0.08} />
            <path d={wedge(10)} opacity={0.15} />
            <path className={styles.edge} d={`M0 0L0 ${-REACH}`} />
          </g>
        </g>
        <path className={styles.land} d={LAND_PATH} />
        <path className={styles.coast} d={LAND_PATH} />
        {CITIES.map((city) => (
          <g key={city.name}>
            <circle className={styles.city} cx={city.point.x} cy={city.point.y} r={3} />
            <text
              className={styles.cityName}
              x={city.point.x + (city.side === "right" ? 10 : -10)}
              y={city.point.y + 4.5}
              textAnchor={city.side === "right" ? "start" : "end"}
            >
              {city.name}
            </text>
          </g>
        ))}
        <circle className={styles.hub} cx={RADAR.x} cy={RADAR.y} r={4} />
        {RadarFlights.FLIGHTS.map((flight, index) => (
          <g
            key={flight.callsign}
            className={styles.plane}
            ref={(element) => {
              planes.current[index] = element;
            }}
          >
            <line data-lead className={styles.lead} x1={0} y1={0} />
            <circle data-echo className={styles.echo} r={20} />
            <path data-glyph className={styles.glyph} d={PLANE_PATH} />
            <text className={styles.tag} x={22} y={-14}>
              {flight.callsign}
            </text>
          </g>
        ))}
      </svg>
      <div className={styles.shade} />
    </div>
  );
}

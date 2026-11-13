import { FlightRoute, type ScenePoint } from "@/services/FlightRoute";
import type { FlightFrame } from "@/services/FlightTimeline";

import styles from "./FlightScene.module.css";
import { CITIES, CORSICA, MAINLAND, RADAR, SceneProjection, TRAFFIC } from "./sceneGeography";

const MAINLAND_PATH = `${FlightRoute.toPath(SceneProjection.points(MAINLAND))}Z`;
const CORSICA_PATH = `${FlightRoute.toPath(SceneProjection.points(CORSICA))}Z`;

/** Meridians and parallels, one per degree, far beyond the country so they fill wide screens. */
const GRATICULE = (() => {
  const lines: string[] = [];
  for (let longitude = -40; longitude <= 45; longitude += 1) {
    lines.push(FlightRoute.toPath([SceneProjection.point(longitude, 62), SceneProjection.point(longitude, 30)]));
  }
  for (let latitude = 30; latitude <= 62; latitude += 1) {
    lines.push(FlightRoute.toPath([SceneProjection.point(-40, latitude), SceneProjection.point(45, latitude)]));
  }
  return lines.join("");
})();

const RADAR_RINGS = [90, 180, 270, 360, 450, 540, 630];
const RADAR_REACH = 720;

/** A slice of the radar disc, from the north, `degrees` wide. */
function wedge(degrees: number): string {
  const angle = (degrees * Math.PI) / 180;
  const x = Math.sin(angle) * RADAR_REACH;
  const y = -Math.cos(angle) * RADAR_REACH;
  return `M0 0L0 ${-RADAR_REACH}A${RADAR_REACH} ${RADAR_REACH} 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}Z`;
}

/** Aircraft seen from above, nose to the north, centred on its position. */
const PLANE_PATH =
  "M0 -13L2.6 -4.5L12 2.5L12 5L2.6 2.2L2 8.5L5.2 11L5.2 12.6L0 11.4L-5.2 12.6L-5.2 11L-2 8.5L-2.6 2.2L-12 5L-12 2.5L-2.6 -4.5Z";

function between(from: ScenePoint, to: ScenePoint, t: number): ScenePoint {
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

export interface FlightSceneProps {
  frame: FlightFrame;
  /** The whole route, drawn as the planned flight. */
  routePath: string;
  callsign: string;
  /** What the drawing shows, for screen readers. */
  label: string;
}

/**
 * The map of the home page: France, the radar, the traffic and one aircraft whose track is
 * drawn as the page scrolls. It only draws the frame it is given.
 */
export default function FlightScene({ frame, routePath, callsign, label }: FlightSceneProps) {
  const { camera, plane } = frame;
  // Marks keep the same size on screen whatever the zoom.
  const unit = 1 / camera.zoom;
  const view = SceneProjection.CENTER;
  const cameraTransform = `translate(${view.x} ${view.y}) scale(${camera.zoom}) translate(${-camera.x} ${-camera.y})`;
  const flying = frame.flight > 0 && frame.flight < 1;

  return (
    <svg
      className={styles.scene}
      viewBox={SceneProjection.VIEW_BOX}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={label}
    >
      <g transform={cameraTransform} style={{ opacity: frame.mapOpacity }}>
        <path className={styles.graticule} d={GRATICULE} />

        <g transform={`translate(${RADAR.x} ${RADAR.y})`}>
          {RADAR_RINGS.map((radius) => (
            <circle key={radius} className={styles.ring} r={radius} />
          ))}
          <g className={styles.beam}>
            <path d={wedge(48)} opacity={0.05} />
            <path d={wedge(26)} opacity={0.08} />
            <path d={wedge(9)} opacity={0.14} />
            <path className={styles.beamEdge} d={`M0 0L0 ${-RADAR_REACH}`} />
          </g>
        </g>

        <path className={styles.land} d={MAINLAND_PATH + CORSICA_PATH} />
        <path className={styles.coast} d={MAINLAND_PATH + CORSICA_PATH} />
        <path
          className={styles.coastLit}
          d={MAINLAND_PATH}
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - frame.outline}
        />
        <path
          className={styles.coastLit}
          d={CORSICA_PATH}
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - frame.outline}
        />

        {CITIES.map((city) => (
          <g key={city.name} transform={`translate(${city.point.x} ${city.point.y}) scale(${unit})`}>
            <circle className={styles.city} r={2.4} />
            <text
              className={styles.cityName}
              x={city.side === "right" ? 8 : -8}
              y={3.5}
              textAnchor={city.side === "right" ? "start" : "end"}
            >
              {city.name}
            </text>
          </g>
        ))}

        {TRAFFIC.map((other, index) => {
          const head = between(other.from, other.to, frame.progress);
          const tail = between(other.from, other.to, Math.max(frame.progress - 0.12, 0));
          return (
            <g key={index} className={styles.traffic}>
              <line x1={tail.x} y1={tail.y} x2={head.x} y2={head.y} />
              <circle cx={head.x} cy={head.y} r={2.2 * unit} />
            </g>
          );
        })}

        <path className={styles.planned} d={routePath} style={{ opacity: frame.hudOpacity }} />
        {frame.track.length > 1 && <path className={styles.track} d={FlightRoute.toPath(frame.track)} />}
        {frame.alertTrack.length > 1 && (
          <path className={styles.alertTrack} d={FlightRoute.toPath(frame.alertTrack)} />
        )}

        <g
          transform={`translate(${plane.x} ${plane.y}) scale(${unit})`}
          className={frame.alert ? styles.planeAlert : styles.plane}
          style={{ opacity: frame.hudOpacity }}
        >
          {frame.alert && (
            <>
              <circle className={styles.pulse} r={16} />
              <circle className={`${styles.pulse} ${styles.pulseLate}`} r={16} />
            </>
          )}
          {flying && <circle className={styles.halo} r={22} />}
          <path className={styles.glyph} d={PLANE_PATH} transform={`rotate(${plane.heading}) scale(1.15)`} />
          <text className={styles.tag} x={24} y={-16}>
            {callsign}
          </text>
        </g>
      </g>
    </svg>
  );
}

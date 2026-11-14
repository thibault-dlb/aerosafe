import { AIRCRAFT_SILHOUETTE } from "@/components/ui/IconSet";
import type { Criticality } from "@/models/Alert";
import { MapTheme } from "@/services/MapTheme";
import { MarkerIcon } from "@/services/MarkerIcon";

import styles from "./AircraftGlyph.module.css";

export interface AircraftGlyphProps {
  /** True heading in degrees from north: the silhouette turns with it. */
  heading?: number | null;
  /** An aircraft on the ground is a hollow diamond. */
  onGround?: boolean | null;
  /** Altitude in metres: it sets the shade, as on the map. */
  altitude?: number | null;
  /** The criticality of an alert in progress: the shape takes its colour. */
  criticality?: Criticality | null;
  /** Width and height in pixels. */
  size?: number;
}

function tone(altitude: number | null | undefined, criticality: Criticality | null | undefined): string {
  if (criticality) return `alert${criticality[0]}${criticality.slice(1).toLowerCase()}`;
  if (altitude === null || altitude === undefined) return "mid";
  if (altitude < MapTheme.LOW_LIMIT) return "low";
  return altitude > MapTheme.HIGH_LIMIT ? "high" : "mid";
}

/** The marker of the map, small, for a list: the same silhouette, heading and shade as on the map. */
export default function AircraftGlyph({ heading, onGround, altitude, criticality, size = 24 }: AircraftGlyphProps) {
  return (
    <svg
      className={`${styles.glyph} ${styles[tone(altitude, criticality)]}`}
      viewBox="-14 -14 28 28"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      {onGround ? (
        <path className={styles.ground} d="M0 -6L6 0L0 6L-6 0Z" />
      ) : (
        <g transform={`rotate(${MarkerIcon.rotation(heading)}) scale(.8)`}>
          <path className={styles.shape} d={AIRCRAFT_SILHOUETTE} />
        </g>
      )}
    </svg>
  );
}

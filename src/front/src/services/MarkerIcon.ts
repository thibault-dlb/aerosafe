import { AIRCRAFT_SILHOUETTE } from "@/components/ui/IconSet";

export interface MarkerLook {
  /** Fill colour of the silhouette, or the outline colour of the diamond of an aircraft on the ground. */
  color: string;
  /** Colour of the map background, used to outline the silhouette. */
  outline: string;
  /** True heading in degrees from north. Without one the nose points north. */
  heading?: number | null;
  /** An aircraft on the ground is a hollow diamond, not a silhouette. */
  onGround?: boolean | null;
  /** Colour of the alert: the marker gets a pulsing echo of that colour. */
  alertColor?: string | null;
  /** Colour of the dashed ring of the selected aircraft. */
  selectedColor?: string | null;
}

/**
 * The SVG of an aircraft marker. The silhouette turns with the heading; an alert adds an echo
 * that pulses (see `AircraftMap.module.css`); an aircraft on the ground is a diamond.
 */
export class MarkerIcon {
  /** Width and height of the marker, in pixels. */
  static readonly SIZE = 44;

  /** A colour from a style sheet, kept only if it cannot break out of the attribute. */
  private static safe(color: string): string {
    return /^[#\w\s(),.%/-]+$/.test(color) ? color : "currentColor";
  }

  /** The heading as a rotation in whole degrees, between 0 and 359. */
  static rotation(heading: number | null | undefined): number {
    if (heading === null || heading === undefined || !Number.isFinite(heading)) {
      return 0;
    }
    return ((Math.round(heading) % 360) + 360) % 360;
  }

  static html(look: MarkerLook): string {
    const color = MarkerIcon.safe(look.color);
    const outline = MarkerIcon.safe(look.outline);
    const alert = look.alertColor ? MarkerIcon.safe(look.alertColor) : null;
    const parts: string[] = [];
    if (alert) {
      parts.push(`<circle class="halo" r="10" fill="none" stroke="${alert}" stroke-width="1.4"/>`);
      parts.push(`<circle r="13" fill="none" stroke="${alert}" stroke-width="1.2" opacity=".8"/>`);
    }
    if (look.selectedColor) {
      const selected = MarkerIcon.safe(look.selectedColor);
      parts.push(`<circle r="17" fill="none" stroke="${selected}" stroke-width="1.6" stroke-dasharray="3 3"/>`);
    }
    if (look.onGround) {
      parts.push(`<path d="M0 -6L6 0L0 6L-6 0Z" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/>`);
    } else {
      const turn = MarkerIcon.rotation(look.heading);
      parts.push(
        `<g transform="rotate(${turn}) scale(.8)"><path d="${AIRCRAFT_SILHOUETTE}" fill="${color}" stroke="${outline}" stroke-width="1.2" stroke-linejoin="round" paint-order="stroke"/></g>`,
      );
    }
    const half = MarkerIcon.SIZE / 2;
    return `<svg viewBox="-${half} -${half} ${MarkerIcon.SIZE} ${MarkerIcon.SIZE}" width="${MarkerIcon.SIZE}" height="${MarkerIcon.SIZE}" aria-hidden="true" focusable="false">${parts.join("")}</svg>`;
  }
}

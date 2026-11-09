import type { Area } from "@/services/AircraftService";

export const AREA_FIELDS = ["south", "west", "north", "east"] as const;
export type AreaField = (typeof AREA_FIELDS)[number];

/** The four bounds, or nothing when all are empty. `null` when only some are filled. */
export function parseArea(bounds: Record<AreaField, string>): Area | undefined | null {
  const filled = AREA_FIELDS.filter((field) => bounds[field].trim() !== "");
  if (filled.length === 0) return undefined;
  if (filled.length < AREA_FIELDS.length) return null;
  const [south, west, north, east] = AREA_FIELDS.map((field) => Number(bounds[field]));
  return { south, west, north, east };
}

import type { MapPosition } from "@/services/MapService";

export interface AircraftMapProps {
  aircraft: MapPosition[];
}

/** Contract used by the dashboard. The `feat/aircraft-lookup` work package completes it. */
export default function AircraftMap({ aircraft }: AircraftMapProps) {
  return <div aria-label={`Map of ${aircraft.length} aircraft`} role="img" />;
}

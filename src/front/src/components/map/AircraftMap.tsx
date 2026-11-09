import { useEffect, useRef } from "react";

import { type MapPosition, MapService } from "@/services/MapService";

export interface AircraftMapProps {
  /** Aircraft markers to draw. */
  aircraft: MapPosition[];
  /** Optional trajectory, one array per continuous segment. */
  trajectory?: MapPosition[][];
}

const EMPTY: MapPosition[][] = [];

/** Contract used by the dashboard: a Leaflet map of aircraft and, optionally, a trajectory. */
export default function AircraftMap({ aircraft, trajectory = EMPTY }: AircraftMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const service = useRef<MapService | null>(null);

  useEffect(() => {
    const map = new MapService();
    map.mount(container.current as HTMLDivElement);
    service.current = map;
    return () => {
      map.destroy();
      service.current = null;
    };
  }, []);

  useEffect(() => {
    service.current?.showAircraft(aircraft);
  }, [aircraft]);

  useEffect(() => {
    service.current?.showSegments(trajectory);
  }, [trajectory]);

  return (
    <div
      ref={container}
      aria-label={`Map of ${aircraft.length} aircraft`}
      role="img"
      style={{ height: 420, width: "100%" }}
    />
  );
}

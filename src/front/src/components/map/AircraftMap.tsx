import { useEffect, useRef } from "react";

import { type MapArea, type MapPosition, MapService } from "@/services/MapService";

import styles from "./AircraftMap.module.css";

export interface AircraftMapProps {
  /** Aircraft markers to draw. */
  aircraft: MapPosition[];
  /** Optional trajectory, one array per continuous segment. */
  trajectory?: MapPosition[][];
  /** Optional search area to draw. */
  area?: MapArea | null;
  /** While true, dragging on the map draws a search area instead of panning it. */
  selectingArea?: boolean;
  /** Called with the area the user has drawn. */
  onAreaDrawn?: (area: MapArea) => void;
  /** Gives the map more height than the default (the dashboard, the record, the flight). */
  size?: "default" | "large";
}

const EMPTY: MapPosition[][] = [];

/** Contract used by the dashboard: a Leaflet map of aircraft and, optionally, a trajectory. */
export default function AircraftMap({
  aircraft,
  trajectory = EMPTY,
  area = null,
  selectingArea = false,
  onAreaDrawn,
  size = "default",
}: AircraftMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const service = useRef<MapService | null>(null);
  // The latest callback, so a new function on each render does not restart the selection.
  const drawn = useRef(onAreaDrawn);
  drawn.current = onAreaDrawn;

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

  useEffect(() => {
    service.current?.showArea(area);
  }, [area]);

  useEffect(() => {
    const map = service.current;
    if (!map || !selectingArea) return;
    map.startAreaSelection((next) => drawn.current?.(next));
    return () => map.stopAreaSelection();
  }, [selectingArea]);

  return (
    <div
      ref={container}
      aria-label={`Map of ${aircraft.length} aircraft`}
      role="img"
      className={[styles.map, size === "large" && styles.large].filter(Boolean).join(" ")}
    />
  );
}

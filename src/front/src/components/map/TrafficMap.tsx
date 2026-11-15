import { type Ref, useEffect, useImperativeHandle, useRef } from "react";

import type { FlightPoint, TrackedSnapshot, TrafficAircraft } from "@/models/Traffic";
import type { Area } from "@/services/AircraftService";
import type { Zone } from "@/services/Basemap";
import { MapService } from "@/services/MapService";
import { TrafficLayer } from "@/services/TrafficLayer";

import styles from "./AircraftMap.module.css";

/** What the page can ask of the map. */
export interface TrafficMapHandle {
  /** What the card of an aircraft shows now, or null if it is not on the map. */
  describe: (id: string) => TrackedSnapshot | null;
  /** Shows the whole zone again. */
  recenter: () => void;
  /** Zooms in (positive) or out (negative), by levels. */
  zoomBy: (levels: number) => void;
}

export interface TrafficMapProps {
  /** The latest reports. A new array replaces the previous one; the aircraft glide in between. */
  aircraft: TrafficAircraft[];
  /** The time the aircraft are carried to, in ms: the clock of the replay, or the real one. */
  clock: () => number;
  /** The area the map shows at first and when `recenter` is called. */
  bounds: Area;
  /** What is outlined on the map. */
  zone: Zone;
  /** The aircraft that is followed, or null. */
  trackedId: string | null;
  /** While true, the map keeps the followed aircraft at its centre. */
  following: boolean;
  /** The flight of the followed aircraft, drawn behind it. */
  trail: FlightPoint[];
  onPick: (id: string | null) => void;
  /** The user moved the map by hand. */
  onUserMove: () => void;
  /** Names the map for screen readers. */
  label: string;
  ref?: Ref<TrafficMapHandle>;
}

/**
 * The map of the dashboard: the drawn base map and the traffic, which moves smoothly. The view is
 * set once, on the zone, and never again unless the user asks (the follow of an aircraft aside): the
 * map does not zoom by itself when the aircraft are refreshed.
 */
export default function TrafficMap({
  aircraft,
  clock,
  bounds,
  zone,
  trackedId,
  following,
  trail,
  onPick,
  onUserMove,
  label,
  ref,
}: TrafficMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const service = useRef<MapService | null>(null);
  const layer = useRef<TrafficLayer | null>(null);
  // The latest values, so a new function on each render does not restart the layer.
  const latest = useRef({ clock, onPick, onUserMove, bounds });
  latest.current = { clock, onPick, onUserMove, bounds };

  useEffect(() => {
    const map = new MapService();
    map.mount(container.current as HTMLDivElement);
    const traffic = new TrafficLayer(
      map.leaflet,
      () => latest.current.clock(),
      undefined,
      { onPick: (id) => latest.current.onPick(id), onUserMove: () => latest.current.onUserMove() },
      map.basemapLayer,
    );
    traffic.mount();
    service.current = map;
    layer.current = traffic;
    return () => {
      traffic.destroy();
      map.destroy();
      layer.current = null;
      service.current = null;
    };
  }, []);

  const fit = (area: Area) => {
    service.current?.leaflet.fitBounds(
      [
        [area.south, area.west],
        [area.north, area.east],
      ],
      { padding: [24, 24], animate: false },
    );
  };

  useEffect(() => {
    service.current?.showZone(zone);
    fit(bounds);
  }, [zone, bounds]);

  useImperativeHandle(
    ref,
    () => ({
      describe: (id) => layer.current?.describe(id) ?? null,
      recenter: () => fit(latest.current.bounds),
      zoomBy: (levels) => service.current?.leaflet.zoomIn(levels, { animate: false }),
    }),
    [],
  );

  useEffect(() => {
    layer.current?.update(aircraft);
  }, [aircraft]);

  useEffect(() => {
    layer.current?.track(trackedId);
    layer.current?.follow(following);
  }, [trackedId, following]);

  useEffect(() => {
    layer.current?.setTrail(trail);
  }, [trail]);

  return <div ref={container} role="img" aria-label={label} className={[styles.map, styles.fill].join(" ")} />;
}

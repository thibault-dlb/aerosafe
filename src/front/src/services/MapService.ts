/* eslint-disable @typescript-eslint/no-unused-vars -- empty contract, see the class comment */

export interface MapPosition {
  latitude: number;
  longitude: number;
}

/**
 * Draws aircraft and trajectories with Leaflet.
 * Frozen signatures. The `feat/aircraft-lookup` work package implements them.
 */
export class MapService {
  mount(_container: HTMLElement): void {
    throw new Error("Not implemented");
  }

  showAircraft(_positions: MapPosition[]): void {
    throw new Error("Not implemented");
  }

  showTrajectory(_points: MapPosition[]): void {
    throw new Error("Not implemented");
  }

  destroy(): void {
    throw new Error("Not implemented");
  }
}

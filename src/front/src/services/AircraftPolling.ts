/** How often the dashboard reads the aircraft. */
export class AircraftPolling {
  /** Live: the collection period of Île-de-France. */
  static readonly LIVE_MS = 30_000;

  /**
   * Replay: the map carries each aircraft forward for 90 simulated seconds at most, so the faster the
   * replay goes, the sooner it must read again. About 30 simulated seconds between two readings, at
   * least once a second and at most once every two.
   */
  static replay(speed: number): number {
    return Math.max(1000, Math.min(2000, 30_000 / Math.max(speed, 1)));
  }
}

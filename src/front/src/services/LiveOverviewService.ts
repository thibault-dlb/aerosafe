import type { Aircraft } from "@/models/Aircraft";
import { ApiError } from "@/services/ApiClient";
import { type Area, AircraftService } from "@/services/AircraftService";
import { AlertService } from "@/services/AlertService";
import { DataModeService } from "@/services/DataModeService";

/** What one request gave: its data, or the reason there is none. */
export type Loaded<T> =
  | { state: "ready"; data: T }
  | { state: "unauthenticated" }
  | { state: "forbidden" }
  | { state: "failed" };

/** What the overview shows once the user is logged in. Each part loads on its own. */
export interface LiveOverviewData {
  /** Aircraft with a known position in the Île-de-France area. */
  aircraft: Loaded<Aircraft[]>;
  /** Alerts whose situation lasts (Supervisor only). */
  activeAlerts: Loaded<number>;
  /** Alerts of the last 24 hours (Supervisor only). */
  dayAlerts: Loaded<number>;
}

/**
 * Collects the figures of the overview from the aircraft and alert endpoints: the live ones,
 * or those of the replay at the simulated instant (the services follow the data mode).
 */
export class LiveOverviewService {
  /** The Île-de-France collection area (docs/open-points.md): latitude 48.0 to 49.3, longitude 1.4 to 3.6. */
  static readonly AREA: Area = { south: 48.0, west: 1.4, north: 49.3, east: 3.6 };
  /** Metropolitan France, the area of the `FRANCE` collection profile: the replayed data covers it. */
  static readonly FRANCE_AREA: Area = { south: 41.3, west: -5.2, north: 51.1, east: 9.6 };
  static readonly MAX_AIRCRAFT = 200;

  constructor(
    private readonly aircraft: AircraftService = new AircraftService(),
    private readonly alerts: AlertService = new AlertService(),
    private readonly modes: DataModeService = new DataModeService(),
  ) {}

  async load(): Promise<LiveOverviewData> {
    const area = this.modes.isReplay() ? LiveOverviewService.FRANCE_AREA : LiveOverviewService.AREA;
    const [aircraft, active, day] = await Promise.allSettled([
      this.aircraft.search({ area, limit: LiveOverviewService.MAX_AIRCRAFT }),
      this.alerts.search({ status: "active", limit: 1 }),
      this.alerts.statistics(),
    ]);
    return {
      aircraft: LiveOverviewService.settle(aircraft, (list) => list.filter((item) => item.hasPosition)),
      activeAlerts: LiveOverviewService.settle(active, (page) => page.total),
      dayAlerts: LiveOverviewService.settle(day, (statistics) => statistics.total),
    };
  }

  private static settle<S, T>(result: PromiseSettledResult<S>, read: (value: S) => T): Loaded<T> {
    if (result.status === "fulfilled") {
      return { state: "ready", data: read(result.value) };
    }
    const reason: unknown = result.reason;
    if (reason instanceof ApiError && reason.status === 401) {
      return { state: "unauthenticated" };
    }
    if (reason instanceof ApiError && reason.status === 403) {
      return { state: "forbidden" };
    }
    return { state: "failed" };
  }
}

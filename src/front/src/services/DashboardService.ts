import type { Aircraft } from "@/models/Aircraft";
import {
  Dashboard,
  type DashboardJson,
  DashboardStatistics,
  type DashboardStatisticsJson,
  type StatisticsPeriod,
} from "@/models/Dashboard";
import { AircraftService, type Area } from "@/services/AircraftService";
import { ApiClient } from "@/services/ApiClient";
import { DataModeService } from "@/services/DataModeService";

/**
 * Reads what the dashboard shows. The figures and the chart come from the dashboard endpoints,
 * open to every account; the aircraft of the map from the aircraft search. In the replay, the
 * alerts are those of the replayed traffic up to the simulated instant; the collection state
 * stays the real one.
 */
export class DashboardService {
  /** The Île-de-France collection area (docs/open-points.md): latitude 48.0 to 49.3, longitude 1.4 to 3.6. */
  static readonly AREA: Area = { south: 48.0, west: 1.4, north: 49.3, east: 3.6 };
  /** Metropolitan France, the area of the `FRANCE` collection profile: the replayed data covers it. */
  static readonly FRANCE_AREA: Area = { south: 41.3, west: -5.2, north: 51.1, east: 9.6 };
  static readonly MAX_AIRCRAFT = 200;

  constructor(
    private readonly client: ApiClient = new ApiClient(),
    private readonly modes: DataModeService = new DataModeService(),
    private readonly aircraft: AircraftService = new AircraftService(),
  ) {}

  async load(): Promise<Dashboard> {
    const json = await this.client.get<DashboardJson>(`/v1/dashboard${this.modes.withSource("")}`);
    return Dashboard.fromJson(json);
  }

  async statistics(period: StatisticsPeriod): Promise<DashboardStatistics> {
    const json = await this.client.get<DashboardStatisticsJson>(
      `/v1/dashboard/statistics${this.modes.withSource(`?period=${period}`)}`,
    );
    return DashboardStatistics.fromJson(json);
  }

  /** The aircraft with a known position in the area the data covers. */
  async trackedAircraft(): Promise<Aircraft[]> {
    const area = this.modes.isReplay() ? DashboardService.FRANCE_AREA : DashboardService.AREA;
    const found = await this.aircraft.search({ area, limit: DashboardService.MAX_AIRCRAFT });
    return found.filter((item) => item.hasPosition);
  }
}

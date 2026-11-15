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
import { FlightHistory } from "@/services/FlightHistory";
import type { FlightPoint } from "@/models/Traffic";

/**
 * Reads what the dashboard shows. The figures and the chart come from the dashboard endpoints,
 * open to every account; the aircraft of the map from the aircraft search. In the replay, the
 * alerts are those of the replayed traffic up to the simulated instant; the collection state
 * stays the real one.
 */
export class DashboardService {
  /** The Île-de-France collection area (docs/open-points.md): latitude 48.0 to 49.3, longitude 1.4 to 3.6. */
  static readonly AREA: Area = { south: 48.0, west: 1.4, north: 49.3, east: 3.6 };
  /**
   * What the replayed data covers: metropolitan France without Corsica plus 100 km all around, which
   * is `france-100km` (docs/historical-data.md). The box that holds that outline.
   */
  static readonly HISTORICAL_AREA: Area = { south: 40.3, west: -6.6, north: 52.1, east: 11.0 };
  /** The map draws every aircraft of the area; the API gives up to this many. */
  static readonly MAX_AIRCRAFT = 2000;

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

  /** Everything known of the flight an aircraft is in, for the line behind it and the profile of its altitude. */
  async flightOf(aircraftId: string): Promise<FlightPoint[]> {
    const observations = await this.aircraft.observations(aircraftId, { limit: FlightHistory.LIMIT });
    return FlightHistory.points(observations);
  }

  /** The aircraft with a known position in the area the data covers. */
  async trackedAircraft(): Promise<Aircraft[]> {
    const area = this.modes.isReplay() ? DashboardService.HISTORICAL_AREA : DashboardService.AREA;
    const found = await this.aircraft.search({ area, limit: DashboardService.MAX_AIRCRAFT });
    return found.filter((item) => item.hasPosition);
  }
}

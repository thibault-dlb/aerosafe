import type { Aircraft } from "@/models/Aircraft";
import {
  type CollectionSummary,
  Dashboard,
  type DashboardJson,
  DashboardStatistics,
  type DashboardStatisticsJson,
  type StatisticsPeriod,
} from "@/models/Dashboard";
import { type AircraftSearch, AircraftService, type Area } from "@/services/AircraftService";
import { ApiClient } from "@/services/ApiClient";
import { DataModeService } from "@/services/DataModeService";
import { FlightHistory } from "@/services/FlightHistory";
import type { FlightPoint } from "@/models/Traffic";

/**
 * Reads what the dashboard shows, for the source chosen. The figures and the chart come from the
 * dashboard endpoints, open to every account; the aircraft of the map from the aircraft search. In the
 * replay, the alerts are those of the replayed traffic up to the simulated instant; the collection state
 * stays the real one, the one of adsb.fi.
 */
export class DashboardService {
  /** The OpenSky Île-de-France area (docs/open-points.md), until the API gives the area of the collection. */
  static readonly AREA: Area = { south: 48.0, west: 1.4, north: 49.3, east: 3.6 };
  /**
   * The live map keeps the aircraft heard in this many seconds: a minute, or two periods of the source
   * when they are longer, so an aircraft never blinks between two collections.
   */
  static heardWithinSeconds(periodSeconds: number | null): number {
    return Math.max(60, 2 * (periodSeconds ?? 30));
  }
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

  /**
   * The aircraft with a known position in the area the data covers: the area of the live collection
   * (given by the dashboard, the Île-de-France box until it is known) and its traffic of the moment, or
   * the area of the replayed data.
   */
  async trackedAircraft(collection: CollectionSummary | null = null): Promise<Aircraft[]> {
    const search: AircraftSearch = this.modes.isReplay()
      ? { area: DashboardService.HISTORICAL_AREA, limit: DashboardService.MAX_AIRCRAFT }
      : {
          area: collection?.area?.bounds ?? DashboardService.AREA,
          limit: DashboardService.MAX_AIRCRAFT,
          heardWithinSeconds: DashboardService.heardWithinSeconds(collection?.periodSeconds ?? null),
        };
    const found = await this.aircraft.search(search);
    return found.filter((item) => item.hasPosition);
  }
}

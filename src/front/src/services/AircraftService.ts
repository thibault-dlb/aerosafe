import { Aircraft, type AircraftJson, Observation, type ObservationJson } from "@/models/Aircraft";
import { Flight, FlightDetail, type FlightDetailJson, type FlightSummaryJson } from "@/models/Flight";
import { ApiClient } from "@/services/ApiClient";

/** Geographic search area, in degrees. */
export interface Area {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Criteria of the aircraft search (UC-01). Empty criteria are left out of the request. */
export interface AircraftSearch {
  icao24?: string;
  registration?: string;
  airline?: string;
  area?: Area;
  limit?: number;
}

export interface ObservationPeriod {
  start?: Date;
  end?: Date;
  limit?: number;
}

/** Calls the aircraft and flights endpoints of the API (BF-04 to BF-08). */
export class AircraftService {
  constructor(private readonly client: ApiClient = new ApiClient()) {}

  static searchQuery(search: AircraftSearch): string {
    const params = new URLSearchParams();
    for (const key of ["icao24", "registration", "airline"] as const) {
      const value = search[key]?.trim();
      if (value) {
        params.set(key, value);
      }
    }
    if (search.area) {
      for (const [key, value] of Object.entries(search.area)) {
        params.set(key, String(value));
      }
    }
    if (search.limit !== undefined) {
      params.set("limit", String(search.limit));
    }
    const query = params.toString();
    return query ? `?${query}` : "";
  }

  async search(search: AircraftSearch): Promise<Aircraft[]> {
    const json = await this.client.get<AircraftJson[]>(
      `/v1/aircraft${AircraftService.searchQuery(search)}`,
    );
    return json.map((item) => Aircraft.fromJson(item));
  }

  async get(aircraftId: string): Promise<Aircraft> {
    const json = await this.client.get<AircraftJson>(`/v1/aircraft/${encodeURIComponent(aircraftId)}`);
    return Aircraft.fromJson(json);
  }

  async observations(aircraftId: string, period: ObservationPeriod = {}): Promise<Observation[]> {
    const params = new URLSearchParams();
    if (period.start) params.set("start", period.start.toISOString());
    if (period.end) params.set("end", period.end.toISOString());
    if (period.limit !== undefined) params.set("limit", String(period.limit));
    const query = params.toString() ? `?${params.toString()}` : "";
    const json = await this.client.get<ObservationJson[]>(
      `/v1/aircraft/${encodeURIComponent(aircraftId)}/observations${query}`,
    );
    return json.map((item) => Observation.fromJson(item));
  }

  async flights(aircraftId: string): Promise<Flight[]> {
    const json = await this.client.get<FlightSummaryJson[]>(
      `/v1/aircraft/${encodeURIComponent(aircraftId)}/flights`,
    );
    return json.map((item) => Flight.fromJson(item));
  }

  async flight(flightId: string): Promise<FlightDetail> {
    const json = await this.client.get<FlightDetailJson>(`/v1/flights/${encodeURIComponent(flightId)}`);
    return FlightDetail.fromDetailJson(json);
  }
}

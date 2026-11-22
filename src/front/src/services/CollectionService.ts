import { ApiClient } from "@/services/ApiClient";
import type { DataMode } from "@/services/DataModeService";

/** A live collection: the replay is not collected. */
export type LiveSource = Exclude<DataMode, "replay">;

/**
 * The actions of the Supervisor on the collection of one live source, OpenSky or adsb.fi (the state
 * itself is in the dashboard).
 */
export class CollectionService {
  constructor(private readonly client: ApiClient = new ApiClient()) {}

  async pause(source: LiveSource = "opensky"): Promise<void> {
    await this.client.post(`/v1/collection/pause?source=${source}`);
  }

  async resume(source: LiveSource = "opensky"): Promise<void> {
    await this.client.post(`/v1/collection/resume?source=${source}`);
  }

  /** Runs one collection of the source now, even when paused. With OpenSky it uses credits. */
  async runNow(source: LiveSource = "opensky"): Promise<void> {
    await this.client.post(`/v1/collection/run?source=${source}`);
  }
}

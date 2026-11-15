import { ApiClient } from "@/services/ApiClient";

/** The actions of the Supervisor on the OpenSky collection (the state itself is in the dashboard). */
export class CollectionService {
  constructor(private readonly client: ApiClient = new ApiClient()) {}

  async pause(): Promise<void> {
    await this.client.post("/v1/collection/pause");
  }

  async resume(): Promise<void> {
    await this.client.post("/v1/collection/resume");
  }

  /** Runs one collection now, even when paused. It uses OpenSky credits. */
  async runNow(): Promise<void> {
    await this.client.post("/v1/collection/run");
  }
}

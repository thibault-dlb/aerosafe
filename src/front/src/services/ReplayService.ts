import { ReplayState, type ReplayStateJson } from "@/models/ReplayState";
import { ApiClient } from "@/services/ApiClient";

/** Calls the replay endpoints of the API: the clock is shared, and a Supervisor drives it. */
export class ReplayService {
  constructor(private readonly client: ApiClient = new ApiClient()) {}

  /** The period of the replayed data and the simulated instant. Every user can read it. */
  async get(): Promise<ReplayState> {
    return ReplayState.fromJson(await this.client.get<ReplayStateJson>("/v1/replay"));
  }

  /** Starts at `at`, even when a replay is running. */
  async start(at: Date, speed: number): Promise<ReplayState> {
    const json = await this.client.post<ReplayStateJson>("/v1/replay/start", {
      at: at.toISOString(),
      speed,
    });
    return ReplayState.fromJson(json);
  }

  async pause(): Promise<ReplayState> {
    return ReplayState.fromJson(await this.client.post<ReplayStateJson>("/v1/replay/pause"));
  }

  async resume(): Promise<ReplayState> {
    return ReplayState.fromJson(await this.client.post<ReplayStateJson>("/v1/replay/resume"));
  }

  async setSpeed(speed: number): Promise<ReplayState> {
    const json = await this.client.post<ReplayStateJson>("/v1/replay/speed", { speed });
    return ReplayState.fromJson(json);
  }
}

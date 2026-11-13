/** What `GET /api/v1/replay` answers. */
export interface ReplayStateJson {
  available: boolean;
  start: string | null;
  end: string | null;
  simulated_at: string | null;
  speed: number;
  paused: boolean;
  finished: boolean;
  server_time: string;
  allowed_speeds: number[];
}

function toDate(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

/**
 * The replay clock as the API gave it. The simulated instant is read once; `now` moves it by
 * the local time gone by since, so the screen follows the clock without asking the API every
 * second. The local time is used, not the time of the server, so a wrong clock on the computer
 * changes nothing.
 */
export class ReplayState {
  constructor(
    readonly available: boolean,
    readonly start: Date | null,
    readonly end: Date | null,
    readonly simulatedAt: Date | null,
    readonly speed: number,
    readonly paused: boolean,
    readonly finished: boolean,
    readonly allowedSpeeds: number[],
    /** Local time (ms) when the API answered. */
    readonly receivedAt: number,
  ) {}

  static fromJson(json: ReplayStateJson, receivedAt: number = Date.now()): ReplayState {
    return new ReplayState(
      json.available,
      toDate(json.start),
      toDate(json.end),
      toDate(json.simulated_at),
      json.speed,
      json.paused,
      json.finished,
      json.allowed_speeds,
      receivedAt,
    );
  }

  /** Whether a replay has been started, by anyone, since the data was imported. */
  get started(): boolean {
    return this.simulatedAt !== null;
  }

  /** Whether the simulated time is moving. */
  get running(): boolean {
    return this.started && !this.paused && !this.finished;
  }

  /** The simulated instant at the local time `at` (ms), or null before any start. */
  now(at: number = Date.now()): Date | null {
    if (this.simulatedAt === null) {
      return null;
    }
    if (!this.running) {
      return this.simulatedAt;
    }
    const elapsed = Math.max(0, at - this.receivedAt);
    let moment = this.simulatedAt.getTime() + elapsed * this.speed;
    if (this.end !== null) {
      moment = Math.min(moment, this.end.getTime());
    }
    return new Date(moment);
  }
}

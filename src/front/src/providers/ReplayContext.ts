import { createContext } from "react";

import type { ReplayState } from "@/models/ReplayState";
import type { ReplayProblem } from "@/services/ReplayProblem";

export interface ReplayContextValue {
  /** The clock as last read from the API; null in the live mode or before the first answer. */
  state: ReplayState | null;
  /** The simulated instant now: it moves between two readings of the API. */
  now: Date | null;
  /** Whether the first reading is still on its way. */
  loading: boolean;
  /** What went wrong with the last request, if anything. */
  problem: ReplayProblem | null;
  start: (at: Date, speed: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  setSpeed: (speed: number) => Promise<void>;
}

export const ReplayContext = createContext<ReplayContextValue | null>(null);

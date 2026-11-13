import type { TranslationKey } from "@/i18n/fr";
import { ApiError } from "@/services/ApiClient";

/** Why a request to the replay endpoints failed, as far as the user has to know. */
export type ReplayProblem = "unauthenticated" | "forbidden" | "invalid" | "failed";

export class ReplayProblems {
  /** Sorts an error: 401 and 403 are about the user, 409 and 422 about what they asked for. */
  static from(failure: unknown): ReplayProblem {
    if (failure instanceof ApiError) {
      if (failure.status === 401) return "unauthenticated";
      if (failure.status === 403) return "forbidden";
      if (failure.status === 409 || failure.status === 422) return "invalid";
    }
    return "failed";
  }

  static message(problem: ReplayProblem): TranslationKey {
    return `replay.error.${problem}`;
  }
}

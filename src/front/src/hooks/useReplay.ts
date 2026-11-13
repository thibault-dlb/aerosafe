import { useContext } from "react";

import { ReplayContext, type ReplayContextValue } from "@/providers/ReplayContext";

/**
 * The replay clock, or null outside `ReplayProvider` (the pages work without it, in the live
 * mode). In the live mode the provider is there but holds no clock.
 */
export function useReplay(): ReplayContextValue | null {
  return useContext(ReplayContext);
}

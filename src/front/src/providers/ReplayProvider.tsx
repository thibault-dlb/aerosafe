import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { usePreferences } from "@/hooks/usePreferences";
import type { ReplayState } from "@/models/ReplayState";
import { ReplayContext, type ReplayContextValue } from "@/providers/ReplayContext";
import { type ReplayProblem, ReplayProblems } from "@/services/ReplayProblem";
import { ReplayService } from "@/services/ReplayService";

/** Time between two readings of the clock: the API is the truth, the screen moves it between. */
export const POLL_MS = 15_000;
/** Time between two moves of the simulated instant on the screen. */
export const TICK_MS = 1_000;

export interface ReplayProviderProps {
  children: ReactNode;
  /** Where the clock comes from. Tests give their own. */
  service?: ReplayService;
}

/**
 * Keeps the replay clock for the pages. It only asks the API in the replay mode: in the live
 * mode it holds nothing and makes no request.
 */
export default function ReplayProvider({ children, service }: ReplayProviderProps) {
  const { mode } = usePreferences();
  const [api] = useState(() => service ?? new ReplayService());
  const [state, setState] = useState<ReplayState | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<ReplayProblem | null>(null);

  useEffect(() => {
    if (mode !== "replay") {
      setState(null);
      setProblem(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function read() {
      try {
        const next = await api.get();
        if (cancelled) return;
        setState(next);
        setProblem(null);
      } catch (failure) {
        if (cancelled) return;
        setProblem(ReplayProblems.from(failure));
      }
      if (cancelled) return;
      setLoading(false);
      timer = setTimeout(() => void read(), POLL_MS);
    }

    setLoading(true);
    void read();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mode, api]);

  useEffect(() => {
    if (state === null) {
      setNow(null);
      return;
    }
    setNow(state.now());
    if (!state.running) return;
    const timer = setInterval(() => setNow(state.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [state]);

  const act = useCallback(async (call: () => Promise<ReplayState>) => {
    try {
      setState(await call());
      setProblem(null);
    } catch (failure) {
      setProblem(ReplayProblems.from(failure));
    }
  }, []);

  const value = useMemo<ReplayContextValue>(
    () => ({
      state,
      now,
      loading,
      problem,
      start: (at, speed) => act(() => api.start(at, speed)),
      pause: () => act(() => api.pause()),
      resume: () => act(() => api.resume()),
      setSpeed: (speed) => act(() => api.setSpeed(speed)),
    }),
    [state, now, loading, problem, act, api],
  );

  return <ReplayContext.Provider value={value}>{children}</ReplayContext.Provider>;
}

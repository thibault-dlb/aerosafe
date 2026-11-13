import { type FormEvent, useState } from "react";

import { useReplay } from "@/hooks/useReplay";
import { useTranslation } from "@/hooks/useTranslation";
import type { ReplayState } from "@/models/ReplayState";
import { ReplayProblems } from "@/services/ReplayProblem";
import { ReplayTime } from "@/services/ReplayTime";

import styles from "./ReplayBar.module.css";

/**
 * The replay clock: the simulated time, and the controls of the Supervisor. The clock is shared:
 * what one user starts, paused or speeds up, every user sees. The API refuses the controls to the
 * others, and the bar says so.
 */
export default function ReplayBar() {
  const { t, language } = useTranslation();
  const replay = useReplay();
  const [startAt, setStartAt] = useState("");

  if (replay === null) {
    return null;
  }
  const { state, now, loading, problem } = replay;
  const problemText = problem ? t(ReplayProblems.message(problem)) : null;

  function onStart(event: FormEvent) {
    event.preventDefault();
    const moment = ReplayTime.fromInput(startAt || (state?.start ? ReplayTime.toInput(state.start) : ""));
    if (moment !== null) {
      void replay?.start(moment, state?.speed ?? 1);
    }
  }

  return (
    <section className={styles.bar} aria-label={t("replay.bar")}>
      {state === null && loading && <p role="status">{t("replay.loading")}</p>}
      {state === null && !loading && problemText && <p role="alert">{problemText}</p>}

      {state !== null && !state.available && <p role="status">{t("replay.unavailable")}</p>}

      {state !== null && state.available && (
        <>
          <div className={styles.row}>
            <p className={styles.time}>
              {now ? (
                <>
                  <span className={styles.label}>{t("replay.time")}</span>{" "}
                  <time dateTime={now.toISOString()}>{ReplayTime.display(now, language)} UTC</time>
                </>
              ) : (
                t("replay.notStarted")
              )}
            </p>

            {state.started && (
              <>
                <button
                  type="button"
                  className={styles.button}
                  disabled={state.finished}
                  onClick={() => void (state.paused ? replay.resume() : replay.pause())}
                >
                  {state.paused ? t("replay.resume") : t("replay.pause")}
                </button>
                <SpeedGroup state={state} onChoose={(speed) => void replay.setSpeed(speed)} />
              </>
            )}
          </div>

          {state.finished && <p role="status">{t("replay.finished")}</p>}

          <form className={styles.row} onSubmit={onStart}>
            <label className={styles.field}>
              {t("replay.startAt")}
              <input
                type="datetime-local"
                value={startAt || (state.start ? ReplayTime.toInput(state.start) : "")}
                min={state.start ? ReplayTime.toInput(state.start) : undefined}
                max={state.end ? ReplayTime.toInput(state.end) : undefined}
                onChange={(event) => setStartAt(event.target.value)}
              />
            </label>
            <button type="submit" className={styles.button}>
              {t("replay.start")}
            </button>
          </form>

          {state.start && state.end && (
            <p className={styles.period}>
              {t("replay.period", {
                start: ReplayTime.short(state.start, language),
                end: ReplayTime.short(state.end, language),
              })}
            </p>
          )}
          {problemText && <p role="alert">{problemText}</p>}
        </>
      )}
    </section>
  );
}

interface SpeedGroupProps {
  state: ReplayState;
  onChoose: (speed: number) => void;
}

function SpeedGroup({ state, onChoose }: SpeedGroupProps) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={t("replay.speed")} className={styles.speeds}>
      {state.allowedSpeeds.map((speed) => (
        <button
          key={speed}
          type="button"
          aria-pressed={state.speed === speed}
          onClick={() => onChoose(speed)}
        >
          {t("replay.speedOption", { speed })}
        </button>
      ))}
    </div>
  );
}

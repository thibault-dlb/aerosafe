import { type FormEvent, useId, useState } from "react";
import { createPortal } from "react-dom";

import Icon from "@/components/ui/Icon";
import { useFullscreenHost } from "@/hooks/useFullscreenHost";
import { useReplay } from "@/hooks/useReplay";
import { useTranslation } from "@/hooks/useTranslation";
import type { ReplayState } from "@/models/ReplayState";
import { ReplayProblems } from "@/services/ReplayProblem";
import { ReplayTime } from "@/services/ReplayTime";

import styles from "./ReplayPlayer.module.css";

/**
 * The replay clock, as a small player floating at the bottom of the page: the simulated time, the
 * pause and the speed, and a button that opens the choice of the instant to start at and the
 * period available. The clock is shared: what one user starts, paused or speeds up, every user
 * sees. The API refuses the controls to the others, and the player says so.
 *
 * It is drawn in the element that is in full screen, if any, so the map in full screen keeps it.
 */
export default function ReplayPlayer() {
  const { t, language } = useTranslation();
  const replay = useReplay();
  const host = useFullscreenHost();
  const panelId = useId();
  const [startAt, setStartAt] = useState("");
  // Until the visitor opens or closes the panel, it is open while the replay has not started.
  const [chosen, setChosen] = useState<boolean | null>(null);

  if (replay === null) {
    return null;
  }
  const { state, now, loading, problem } = replay;
  const problemText = problem ? t(ReplayProblems.message(problem)) : null;
  const ready = state !== null && state.available;
  const open = ready && (chosen ?? !state.started);

  function onStart(event: FormEvent) {
    event.preventDefault();
    const moment = ReplayTime.fromInput(startAt || (state?.start ? ReplayTime.firstInput(state.start) : ""));
    if (moment !== null) {
      setChosen(false);
      void replay?.start(moment, state?.speed ?? 1);
    }
  }

  return createPortal(
    <section className={styles.player} aria-label={t("replay.bar")}>
      {state === null && !loading && problemText && <p role="alert" className={styles.message}>{problemText}</p>}
      {ready && state.finished && <p role="status" className={styles.message}>{t("replay.finished")}</p>}
      {ready && problemText && <p role="alert" className={styles.message}>{problemText}</p>}

      {open && (
        <div id={panelId} className={styles.panel}>
          {!state.started && <p>{t("replay.notStarted")}</p>}
          <form className={styles.form} onSubmit={onStart}>
            <label className={styles.field}>
              {t("replay.startAt")}
              <input
                type="datetime-local"
                value={startAt || (state.start ? ReplayTime.firstInput(state.start) : "")}
                min={state.start ? ReplayTime.firstInput(state.start) : undefined}
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
        </div>
      )}

      <div className={styles.pill}>
        {state === null && loading && <p role="status">{t("replay.loading")}</p>}
        {state !== null && !state.available && <p role="status">{t("replay.unavailable")}</p>}

        {ready && (
          <>
            <p className={styles.time}>
              <span className={styles.label}>{t("replay.time")}</span>{" "}
              {now ? (
                <time dateTime={now.toISOString()}>{ReplayTime.display(now, language)} UTC</time>
              ) : (
                <span>{t("replay.idle")}</span>
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

            <button
              type="button"
              className={styles.settings}
              aria-expanded={open}
              aria-controls={panelId}
              aria-label={t("replay.settings")}
              title={t("replay.settings")}
              onClick={() => setChosen(!open)}
            >
              <Icon name="clock" size={18} />
            </button>
          </>
        )}
      </div>
    </section>,
    host,
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

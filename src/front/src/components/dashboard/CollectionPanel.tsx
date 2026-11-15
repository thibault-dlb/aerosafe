import Button from "@/components/ui/Button";
import Panel from "@/components/ui/Panel";
import { usePreferences } from "@/hooks/usePreferences";
import type { CollectionSummary } from "@/models/Dashboard";
import { Formatter } from "@/services/Formatter";

import styles from "./Dashboard.module.css";

export interface CollectionPanelProps {
  collection: CollectionSummary;
  /** The Supervisor gets the buttons; any other account only reads the state. */
  onPause?: () => void;
  onResume?: () => void;
  onRun?: () => void;
  /** An action is in progress: the buttons wait. */
  busy?: boolean;
}

/** State of the OpenSky collection: last success, credits, mini history, and its controls. */
export default function CollectionPanel({ collection, onPause, onResume, onRun, busy = false }: CollectionPanelProps) {
  const { t } = usePreferences();
  let state = t("dashboard.collection.active");
  if (!collection.enabled) state = t("dashboard.collection.disabled");
  else if (collection.paused) state = t("dashboard.collection.paused");
  else if (collection.running) state = t("dashboard.collection.running");
  const controls = Boolean(onPause && onResume && onRun) && collection.enabled;

  return (
    <Panel title={t("dashboard.collection.title")}>
      <dl className={styles.state}>
        <dt>{t("dashboard.collection.state")}</dt>
        <dd>{state}</dd>
        <dt>{t("dashboard.collection.lastSuccess")}</dt>
        <dd className="mono">
          {collection.lastSuccessAt ? Formatter.date(collection.lastSuccessAt) : t("dashboard.collection.never")}
        </dd>
        <dt>{t("dashboard.collection.credits")}</dt>
        <dd className="mono">{collection.remainingCredits ?? Formatter.MISSING}</dd>
      </dl>
      {collection.recentRuns.length > 0 && (
        <>
          <p>{t("dashboard.collection.history")}</p>
          <ul className={styles.history}>
            {[...collection.recentRuns].reverse().map((run) => {
              const text = t(run.collected ? "dashboard.collection.run.ok" : "dashboard.collection.run.failed", {
                time: Formatter.date(run.startedAt),
              });
              return (
                <li
                  key={run.startedAt.toISOString()}
                  className={`${styles.run} ${run.collected ? styles.ok : ""}`}
                  title={text}
                  aria-label={text}
                />
              );
            })}
          </ul>
        </>
      )}
      {controls && (
        <div className={styles.actions}>
          {collection.paused ? (
            <Button variant="secondary" onClick={onResume} disabled={busy}>
              {t("dashboard.collection.resume")}
            </Button>
          ) : (
            <Button variant="secondary" onClick={onPause} disabled={busy}>
              {t("dashboard.collection.pause")}
            </Button>
          )}
          <Button onClick={onRun} disabled={busy || collection.running}>
            {t("dashboard.collection.runNow")}
          </Button>
        </div>
      )}
    </Panel>
  );
}

import Button from "@/components/ui/Button";
import Panel from "@/components/ui/Panel";
import { usePreferences } from "@/hooks/usePreferences";
import type { TranslationKey } from "@/i18n/fr";
import type { CollectionSummary } from "@/models/Dashboard";
import type { DataMode } from "@/services/DataModeService";
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

const SOURCE_NAMES: Record<DataMode, string> = { opensky: "OpenSky", adsbfi: "adsb.fi", replay: "adsb.fi" };
const PRECISION: Record<DataMode, TranslationKey> = {
  opensky: "dashboard.collection.precision.opensky",
  adsbfi: "dashboard.collection.precision.adsbfi",
  replay: "dashboard.collection.precision.adsbfi",
};

/**
 * State of the collection of one live source: its pace and precision, last success, credits (OpenSky
 * only), mini history, and its controls.
 */
export default function CollectionPanel({ collection, onPause, onResume, onRun, busy = false }: CollectionPanelProps) {
  const { t } = usePreferences();
  let state = t("dashboard.collection.active");
  if (!collection.enabled) state = t("dashboard.collection.disabled");
  else if (collection.paused) state = t("dashboard.collection.paused");
  else if (collection.running) state = t("dashboard.collection.running");
  const controls = Boolean(onPause && onResume && onRun) && collection.enabled;

  return (
    <Panel title={t("dashboard.collection.title", { source: SOURCE_NAMES[collection.source] })}>
      <dl className={styles.state}>
        <dt>{t("dashboard.collection.state")}</dt>
        <dd>{state}</dd>
        {collection.periodSeconds !== null && (
          <>
            <dt>{t("dashboard.collection.period")}</dt>
            <dd>{t("dashboard.collection.every", { seconds: collection.periodSeconds })}</dd>
          </>
        )}
        <dt>{t("dashboard.collection.precision")}</dt>
        <dd>{t(PRECISION[collection.source])}</dd>
        <dt>{t("dashboard.collection.lastSuccess")}</dt>
        <dd className="mono">
          {collection.lastSuccessAt ? Formatter.date(collection.lastSuccessAt) : t("dashboard.collection.never")}
        </dd>
        {collection.countsCredits && (
          <>
            <dt>{t("dashboard.collection.credits")}</dt>
            <dd className="mono">{collection.remainingCredits ?? Formatter.MISSING}</dd>
          </>
        )}
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

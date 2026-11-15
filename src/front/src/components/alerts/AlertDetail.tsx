import { Link } from "react-router-dom";

import Button, { ButtonLink } from "@/components/ui/Button";
import CriticalityMark from "@/components/ui/CriticalityMark";
import Icon from "@/components/ui/Icon";
import Pill from "@/components/ui/Pill";
import RuleDiagram from "@/components/ui/RuleDiagram";
import RuleIcon from "@/components/ui/RuleIcon";
import { usePreferences } from "@/hooks/usePreferences";
import type { Alert } from "@/models/Alert";
import { Formatter } from "@/services/Formatter";
import { RuleLabels } from "@/services/RuleLabels";

import styles from "./AlertDetail.module.css";

export interface AlertDetailProps {
  alert: Alert;
  onClose: () => void;
  /** Marks the alert as processed. */
  onProcess: (alert: Alert) => void;
  /** True while the alert is being processed. */
  processing?: boolean;
}

/** Share of the gauge the larger of the two values takes: the rest is room for the threshold mark. */
const GAUGE_HEADROOM = 1.2;

/** The details of one alert: what was observed against the threshold, the rule, the aircraft and the message. */
export default function AlertDetail({ alert, onClose, onProcess, processing = false }: AlertDetailProps) {
  const { t, units } = usePreferences();
  const { observedValue, threshold, unit } = alert;
  // A descent has a negative vertical rate: the gauge compares its size with the threshold.
  const size = observedValue === null ? null : Math.abs(observedValue);
  const gauge =
    size !== null && threshold !== null && Math.max(size, threshold) > 0
      ? {
          scale: Math.max(size, threshold) * GAUGE_HEADROOM,
          over: size > threshold,
        }
      : null;

  return (
    <section className={styles.detail} aria-labelledby="alert-detail-title">
      <header className={styles.header}>
        <h2 id="alert-detail-title" className={styles.title}>
          {t("alerts.detail.title")}
        </h2>
        <button type="button" className={styles.close} aria-label={t("alerts.detail.close")} onClick={onClose}>
          <Icon name="close" size={16} />
        </button>
      </header>

      <div className={styles.body}>
        <div className={styles.headline}>
          <span className={styles.badge}>
            <RuleIcon code={alert.ruleCode} size={24} />
          </span>
          <div>
            <p className={styles.rule}>
              {alert.ruleCode} · {RuleLabels.name(alert.ruleCode, alert.ruleDescription, t)}
            </p>
            <p className={styles.muted}>{t("alerts.detail.triggeredAt", { date: Formatter.date(alert.triggeredAt) })}</p>
          </div>
        </div>

        <div className={styles.states}>
          <CriticalityMark level={alert.criticality} variant="badge" />
          <Pill tone={alert.active ? "active" : "neutral"}>
            {t(alert.active ? "alerts.situation.active" : "alerts.situation.ended")}
          </Pill>
          {alert.processed ? (
            <Pill tone="done">{t("alerts.processing.processed")}</Pill>
          ) : (
            <Pill tone="open">{t("alerts.processing.unprocessed")}</Pill>
          )}
        </div>

        <div className={styles.versus}>
          <div className={styles.numbers}>
            <strong className={gauge?.over ? styles.over : undefined}>
              {Formatter.ruleValue(observedValue, unit, units)}
            </strong>
            <span className={styles.muted}>
              {t("alerts.detail.threshold", { value: Formatter.ruleValue(threshold, unit, units) })}
            </span>
          </div>
          {gauge && size !== null && threshold !== null && (
            <div className={styles.gauge} aria-hidden="true">
              <i className={gauge.over ? styles.fillOver : styles.fill} style={{ width: `${(size / gauge.scale) * 100}%` }} />
              <u style={{ left: `${(threshold / gauge.scale) * 100}%` }} />
            </div>
          )}
        </div>

        <RuleDiagram code={alert.ruleCode} className={styles.diagram} />

        <dl className={styles.facts}>
          <dt>{t("alerts.detail.aircraft")}</dt>
          <dd>
            <Link to={`/aircraft/${alert.aircraftId}`} className={styles.mono}>
              {alert.aircraftName || Formatter.MISSING}
            </Link>
            <span className={styles.muted}> · {alert.icao24}</span>
          </dd>
          <dt>{t("alerts.detail.endedAt")}</dt>
          <dd>{alert.episodeEndedAt ? Formatter.date(alert.episodeEndedAt) : t("alerts.detail.stillActive")}</dd>
          <dt>{t("alerts.detail.processing")}</dt>
          <dd>
            {alert.processedAt
              ? t("alerts.detail.processedAt", { date: Formatter.date(alert.processedAt) })
              : t("alerts.detail.notProcessed")}
          </dd>
        </dl>

        <p className={styles.message}>{alert.message}</p>

        <div className={styles.actions}>
          {!alert.processed && (
            <Button disabled={processing} onClick={() => onProcess(alert)}>
              <Icon name="check" size={16} />
              {t("alerts.detail.markProcessed")}
            </Button>
          )}
          <ButtonLink to={`/aircraft/${alert.aircraftId}`} variant="secondary">
            <Icon name="aircraft" size={16} />
            {t("alerts.detail.viewAircraft")}
          </ButtonLink>
        </div>

        <Link to="/rules" className={styles.adjust}>
          {t("alerts.detail.adjust", { rule: alert.ruleCode })}
        </Link>
      </div>
    </section>
  );
}

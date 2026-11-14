import Button from "@/components/ui/Button";
import CriticalityMark from "@/components/ui/CriticalityMark";
import Icon from "@/components/ui/Icon";
import Pill from "@/components/ui/Pill";
import RuleIcon from "@/components/ui/RuleIcon";
import Table from "@/components/ui/Table";
import { usePreferences } from "@/hooks/usePreferences";
import type { TranslationKey } from "@/i18n/fr";
import type { Alert } from "@/models/Alert";
import type { AlertSort } from "@/services/AlertService";
import { Formatter } from "@/services/Formatter";

import styles from "./AlertTable.module.css";

export interface AlertSorting {
  key: AlertSort;
  order: "asc" | "desc";
}

export interface AlertTableProps {
  alerts: Alert[];
  caption?: string;
  /** Called when the Supervisor opens the details of an alert, by a click or from the keyboard. */
  onSelect?: (alert: Alert) => void;
  /** Called by the "Process" button; without it, the button is not shown. */
  onProcess?: (alert: Alert) => void;
  /** Identifier of the alert being processed, whose button is disabled. */
  processingId?: string | null;
  /** Identifier of the alert whose details are open: its row is highlighted. */
  selectedId?: string | null;
  /** How the list is sorted. With `onSort`, the headers of the sortable columns are buttons. */
  sorting?: AlertSorting;
  onSort?: (key: AlertSort) => void;
  /** Hides the columns the details show again (the value and the situation), to leave room beside them. */
  compact?: boolean;
}

interface SortHeaderProps {
  label: string;
  short?: string;
  column: AlertSort;
  sorting?: AlertSorting;
  onSort?: (key: AlertSort) => void;
}

function SortHeader({ label, short, column, sorting, onSort }: SortHeaderProps) {
  const { t } = usePreferences();
  const active = sorting?.key === column;
  let ariaSort: "ascending" | "descending" | undefined;
  if (active) ariaSort = sorting.order === "asc" ? "ascending" : "descending";
  return (
    <th scope="col" aria-sort={ariaSort}>
      {onSort ? (
        <button
          type="button"
          className={[styles.sort, active && styles.sorted].filter(Boolean).join(" ")}
          aria-label={t("alerts.sort", { column: label })}
          title={label}
          onClick={() => onSort(column)}
        >
          {short ?? label}
          {active && <Icon name="chevron" size={10} className={sorting.order === "asc" ? styles.up : styles.down} />}
        </button>
      ) : (
        (short ?? label)
      )}
    </th>
  );
}

const SITUATION: Record<"active" | "ended", TranslationKey> = {
  active: "alerts.situation.active",
  ended: "alerts.situation.ended",
};

/** Alerts as a table (BF-12). Contract used by the dashboard: the new props are optional. */
export default function AlertTable({
  alerts,
  caption,
  onSelect,
  onProcess,
  processingId = null,
  selectedId = null,
  sorting,
  onSort,
  compact = false,
}: AlertTableProps) {
  const { t, units } = usePreferences();
  // Where the page is narrow the same columns give way (see the stylesheet).
  const optional = [styles.narrowHidden, compact && styles.compact].filter(Boolean).join(" ");
  return (
    <Table>
      {caption && <caption>{caption}</caption>}
      <thead>
        <tr>
          <SortHeader column="criticality" label={t("alerts.column.criticality")} short={t("alerts.column.criticalityShort")} sorting={sorting} onSort={onSort} />
          <SortHeader column="rule" label={t("alerts.column.rule")} sorting={sorting} onSort={onSort} />
          <th scope="col">{t("alerts.column.aircraft")}</th>
          <SortHeader column="triggered_at" label={t("alerts.column.triggered")} sorting={sorting} onSort={onSort} />
          <th scope="col" className={optional}>
            {t("alerts.column.value")}
          </th>
          <th scope="col" className={optional}>
            {t("alerts.column.situation")}
          </th>
          <th scope="col">{t("alerts.column.processing")}</th>
        </tr>
      </thead>
      <tbody>
        {alerts.map((alert) => {
          const aircraft = alert.aircraftName || Formatter.MISSING;
          const selected = selectedId === alert.id;
          const status = alert.status;
          return (
            <tr
              key={alert.id}
              aria-selected={onSelect ? selected : undefined}
              className={onSelect ? styles.pick : undefined}
              onClick={onSelect ? () => onSelect(alert) : undefined}
            >
              <td className={styles.tight}>
                <CriticalityMark level={alert.criticality} />
              </td>
              <td>
                {onSelect ? (
                  <button
                    type="button"
                    className={styles.rule}
                    aria-label={t("alerts.detailsLabel", { rule: alert.ruleCode, aircraft })}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(alert);
                    }}
                  >
                    <RuleIcon code={alert.ruleCode} size={18} />
                    {alert.ruleCode}
                  </button>
                ) : (
                  <span className={styles.rule}>
                    <RuleIcon code={alert.ruleCode} size={18} />
                    {alert.ruleCode}
                  </span>
                )}
              </td>
              <td className={styles.mono}>{aircraft}</td>
              <td className={styles.mono}>{Formatter.date(alert.triggeredAt)}</td>
              <td className={`${styles.mono} ${optional}`}>
                {Formatter.ruleValue(alert.observedValue, alert.unit, units)}{" "}
                <span className={styles.muted}>/ {Formatter.ruleValue(alert.threshold, alert.unit, units)}</span>
              </td>
              <td className={optional}>
                {status === "processed" ? (
                  <Pill>{t(SITUATION[alert.active ? "active" : "ended"])}</Pill>
                ) : (
                  <Pill tone={status === "active" ? "active" : "neutral"}>{t(SITUATION[status])}</Pill>
                )}
              </td>
              <td>
                {status === "processed" ? (
                  <Pill tone="done">{t("alerts.processing.processed")}</Pill>
                ) : onProcess ? (
                  <Button
                    variant="secondary"
                    className={styles.process}
                    disabled={processingId === alert.id}
                    aria-label={t("alerts.processLabel", { rule: alert.ruleCode, aircraft })}
                    onClick={(event) => {
                      event.stopPropagation();
                      onProcess(alert);
                    }}
                  >
                    <Icon name="check" size={14} />
                    {t("alerts.process")}
                  </Button>
                ) : (
                  <Pill tone="open">{t("alerts.processing.unprocessed")}</Pill>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

import { Link } from "react-router-dom";

import AlertTable from "@/components/alerts/AlertTable";
import EmptyState from "@/components/ui/EmptyState";
import Panel from "@/components/ui/Panel";
import { usePreferences } from "@/hooks/usePreferences";
import type { Alert } from "@/models/Alert";

import styles from "./Dashboard.module.css";

export interface ActiveAlertsProps {
  alerts: Alert[];
  /** Number of alerts whose situation lasts, all of them: the table shows the latest ones. */
  total: number;
  /** The Supervisor processes an alert from here; for any other account the table is read only. */
  onProcess?: (alert: Alert) => void;
  processingId?: string | null;
  /** Only the Supervisor has the alerts page to open. */
  linkToAlerts?: boolean;
}

/** The latest alerts whose situation lasts. */
export default function ActiveAlerts({ alerts, total, onProcess, processingId, linkToAlerts = false }: ActiveAlertsProps) {
  const { t } = usePreferences();
  return (
    <Panel title={t("dashboard.alerts.title")}>
      {alerts.length === 0 ? (
        <EmptyState kind="alerts" title={t("dashboard.alerts.empty.title")}>
          {t("dashboard.alerts.empty.body")}
        </EmptyState>
      ) : (
        <AlertTable alerts={alerts} compact onProcess={onProcess} processingId={processingId} />
      )}
      {linkToAlerts && (
        <Link className={styles.more} to="/alerts">
          {t("dashboard.alerts.all", { count: total })}
        </Link>
      )}
    </Panel>
  );
}

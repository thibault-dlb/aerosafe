import StatTile from "@/components/ui/StatTile";
import { usePreferences } from "@/hooks/usePreferences";

import styles from "./Dashboard.module.css";

export interface CounterRowProps {
  /** Aircraft followed on the map; null while they are not loaded. */
  aircraft: number | null;
  active: number;
  unprocessed: number;
  last24h: number;
}

/** The four figures at the top of the dashboard. */
export default function CounterRow({ aircraft, active, unprocessed, last24h }: CounterRowProps) {
  const { t } = usePreferences();
  return (
    <div className={styles.counters}>
      <StatTile label={t("dashboard.counter.aircraft")} value={aircraft ?? "–"} />
      <StatTile label={t("dashboard.counter.active")} value={active} />
      <StatTile label={t("dashboard.counter.unprocessed")} value={unprocessed} />
      <StatTile label={t("dashboard.counter.day")} value={last24h} />
    </div>
  );
}

import Chip from "@/components/ui/Chip";
import Panel from "@/components/ui/Panel";
import { usePreferences } from "@/hooks/usePreferences";
import type { DashboardStatistics, StatisticsPeriod } from "@/models/Dashboard";

import styles from "./Dashboard.module.css";
import { ruleClass } from "./ruleClass";

const PERIODS: StatisticsPeriod[] = ["24h", "7d", "30d"];
const WIDTH = 600;
const HEIGHT = 200;
const LEFT = 28;
const BOTTOM = 18;
const TOP = 8;
const GAP = 2;

export interface AlertChartProps {
  statistics: DashboardStatistics | null;
  period: StatisticsPeriod;
  onPeriod: (period: StatisticsPeriod) => void;
}

/** Alerts per hour or per day, stacked by rule. No library: bars in SVG and a table of the data. */
export default function AlertChart({ statistics, period, onPeriod }: AlertChartProps) {
  const { t, language } = usePreferences();
  const codes = statistics?.ruleCodes ?? [];
  const peak = Math.max(statistics?.peak ?? 0, 1);
  const slices = statistics?.slices ?? [];
  const band = (WIDTH - LEFT) / Math.max(slices.length, 1);
  const plot = HEIGHT - BOTTOM - TOP;
  const scale = (value: number) => (value / peak) * plot;
  const label = (start: Date) =>
    statistics?.unit === "hour"
      ? start.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
      : start.toLocaleDateString(language, { day: "2-digit", month: "2-digit", timeZone: "UTC" });

  return (
    <Panel title={t("dashboard.chart.title")}>
      <div className={styles.head}>
        <div className={styles.periods} role="group" aria-label={t("dashboard.chart.period")}>
          {PERIODS.map((value) => (
            <Chip key={value} pressed={period === value} onClick={() => onPeriod(value)}>
              {t(`dashboard.chart.period.${value}`)}
            </Chip>
          ))}
        </div>
      </div>
      {statistics && statistics.total === 0 ? (
        <p>{t("dashboard.chart.empty")}</p>
      ) : (
        <>
          <svg
            className={styles.chart}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-label={t("dashboard.chart.label", { total: statistics?.total ?? 0 })}
          >
            <line className={styles.axis} x1={LEFT} x2={WIDTH} y1={HEIGHT - BOTTOM} y2={HEIGHT - BOTTOM} />
            <text className={styles.tick} x={LEFT - 4} y={TOP + 8} textAnchor="end">
              {peak}
            </text>
            <text className={styles.tick} x={LEFT - 4} y={HEIGHT - BOTTOM} textAnchor="end">
              0
            </text>
            {slices.map((slice, index) => {
              let floor = HEIGHT - BOTTOM;
              const x = LEFT + index * band + GAP / 2;
              return (
                <g key={slice.start.toISOString()}>
                  {codes.map((code) => {
                    const count = slice.perRule[code] ?? 0;
                    if (count === 0) return null;
                    const height = scale(count);
                    floor -= height;
                    return (
                      <rect
                        key={code}
                        className={`${styles.bar} ${ruleClass(code)}`}
                        x={x}
                        y={floor}
                        width={Math.max(band - GAP, 1)}
                        height={height}
                        rx={1}
                      />
                    );
                  })}
                  {index % Math.ceil(slices.length / 6) === 0 && (
                    <text className={styles.tick} x={x + (band - GAP) / 2} y={HEIGHT - 4} textAnchor="middle">
                      {label(slice.start)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <ul className={styles.legend}>
            {codes.map((code) => (
              <li key={code}>
                <span className={`${styles.swatch} ${ruleClass(code)}`} aria-hidden="true" />
                {code}
              </li>
            ))}
          </ul>
          <details className={styles.data}>
            <summary>{t("dashboard.chart.table")}</summary>
            <table>
              <thead>
                <tr>
                  <th scope="col">{t("dashboard.chart.slice")}</th>
                  {codes.map((code) => (
                    <th key={code} scope="col">
                      {code}
                    </th>
                  ))}
                  <th scope="col">{t("dashboard.chart.total")}</th>
                </tr>
              </thead>
              <tbody>
                {slices.map((slice) => (
                  <tr key={slice.start.toISOString()}>
                    <th scope="row">{label(slice.start)}</th>
                    {codes.map((code) => (
                      <td key={code}>{slice.perRule[code] ?? 0}</td>
                    ))}
                    <td>{slice.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </Panel>
  );
}

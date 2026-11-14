import { type PointerEvent, useState } from "react";

import { useTranslation } from "@/hooks/useTranslation";

import styles from "./Profile.module.css";

export interface ProfilePoint {
  /** Time in milliseconds. */
  time: number;
  /** Value in the unit shown. */
  value: number;
}

/** A stretch of time with no observation: the line is cut there and the stretch is shaded. */
export interface ProfileGap {
  start: number;
  end: number;
}

export interface ProfileProps {
  title: string;
  unit: string;
  points: ProfilePoint[];
  gaps?: ProfileGap[];
}

const WIDTH = 420;
const HEIGHT = 150;
const LEFT = 44;
const RIGHT = 8;
const TOP = 8;
const BOTTOM = 20;

/** A round number at or above `value`, with at most two significant digits: 10400 gives 11000. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value)) / 10;
  return Math.ceil(value / magnitude) * magnitude;
}

function clock(time: number): string {
  return new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Splits the points where a gap lies between two of them, so the line is not drawn across it. */
function runs(points: ProfilePoint[], gaps: ProfileGap[]): ProfilePoint[][] {
  const result: ProfilePoint[][] = [];
  let current: ProfilePoint[] = [];
  points.forEach((point, index) => {
    const previous = points[index - 1];
    if (previous && gaps.some((gap) => gap.start >= previous.time && gap.end <= point.time)) {
      result.push(current);
      current = [];
    }
    current.push(point);
  });
  result.push(current);
  return result;
}

/** A line chart of one flight parameter over time (UC-02, step 3): read a value by pointing at the curve. */
export default function Profile({ title, unit, points, gaps = [] }: ProfileProps) {
  const { t } = useTranslation();
  const [hover, setHover] = useState<number | null>(null);

  if (points.length < 2) {
    return (
      <figure className={styles.profile}>
        <figcaption className={styles.caption}>{title}</figcaption>
        <p className={styles.muted}>{t("flight.profile.notEnough")}</p>
      </figure>
    );
  }

  const times = points.map((point) => point.time);
  const [minTime, maxTime] = [Math.min(...times), Math.max(...times)];
  const top = niceMax(Math.max(...points.map((point) => point.value)));
  const x = (time: number) => LEFT + ((time - minTime) / (maxTime - minTime || 1)) * (WIDTH - LEFT - RIGHT);
  const y = (value: number) => TOP + (1 - value / top) * (HEIGHT - TOP - BOTTOM);
  const base = HEIGHT - BOTTOM;
  const segments = runs(points, gaps).filter((run) => run.length > 0);
  const path = (run: ProfilePoint[]) => run.map((point, index) => `${index ? "L" : "M"}${x(point.time).toFixed(1)} ${y(point.value).toFixed(1)}`).join("");

  function onMove(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0) return;
    const at = ((event.clientX - box.left) / box.width) * WIDTH;
    let nearest = 0;
    points.forEach((point, index) => {
      if (Math.abs(x(point.time) - at) < Math.abs(x(points[nearest].time) - at)) nearest = index;
    });
    setHover(nearest);
  }

  const shown = hover === null ? null : points[hover];
  return (
    <figure className={styles.profile}>
      <figcaption className={styles.caption}>
        <span>
          {title} ({unit})
        </span>
        <span className={styles.reading}>
          {shown ? t("flight.profile.reading", { time: clock(shown.time), value: `${shown.value.toFixed(0)} ${unit}` }) : ""}
        </span>
      </figcaption>
      <svg
        className={styles.chart}
        role="img"
        aria-label={t("flight.profile.label", { title })}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {[0, 0.5, 1].map((share) => (
          <g key={share}>
            <path className={styles.grid} d={`M${LEFT} ${y(top * share)}H${WIDTH - RIGHT}`} />
            <text className={styles.label} x={LEFT - 6} y={y(top * share) + 3} textAnchor="end">
              {Math.round(top * share)}
            </text>
          </g>
        ))}
        {gaps.map((gap) => (
          <rect
            key={`${gap.start}-${gap.end}`}
            className={styles.gap}
            x={x(Math.max(gap.start, minTime))}
            y={TOP}
            width={Math.max(0, x(Math.min(gap.end, maxTime)) - x(Math.max(gap.start, minTime)))}
            height={base - TOP}
          />
        ))}
        {segments.map((run) => (
          <g key={run[0].time}>
            <path className={styles.area} d={`${path(run)}L${x(run[run.length - 1].time).toFixed(1)} ${base}L${x(run[0].time).toFixed(1)} ${base}Z`} />
            <path className={styles.line} d={path(run)} />
          </g>
        ))}
        {gaps.length > 0 && (
          <text className={styles.label} x={x(Math.max(gaps[0].start, minTime))} y={TOP + 10}>
            {t("flight.profile.noData")}
          </text>
        )}
        {shown && (
          <>
            <path className={styles.cross} d={`M${x(shown.time)} ${TOP}V${base}`} />
            <circle className={styles.point} cx={x(shown.time)} cy={y(shown.value)} r={4} />
          </>
        )}
        <text className={styles.label} x={LEFT} y={HEIGHT - 5}>
          {clock(minTime)}
        </text>
        <text className={styles.label} x={WIDTH - RIGHT} y={HEIGHT - 5} textAnchor="end">
          {clock(maxTime)}
        </text>
      </svg>
    </figure>
  );
}

import type { ReactNode } from "react";

import { useTranslation } from "@/hooks/useTranslation";
import { AIRCRAFT_SILHOUETTE } from "@/components/ui/IconSet";

import styles from "./RuleDiagram.module.css";

export interface RuleDiagramProps {
  /** The code of the rule, `R1` to `R5`. A rule added later has no diagram: nothing is drawn. */
  code: string;
  className?: string;
}

type Translate = ReturnType<typeof useTranslation>["t"];

const TICKS_BEFORE = [20, 38, 56, 74];
const TICKS_AFTER = [92, 110, 128, 146, 164, 182, 200];

function Ticks({ xs }: { xs: number[] }) {
  return (
    <>
      {xs.map((x) => (
        <path key={x} className={styles.tick} d={`M${x} 64V76`} />
      ))}
    </>
  );
}

/** R1 and R2: messages arriving over time, then silence (R1) or messages without a position (R2). */
function Silence({ t, positions }: { t: Translate; positions: boolean }) {
  const y = positions ? 43 : 40;
  return (
    <>
      <path className={styles.axis} d="M10 70H212" />
      <Ticks xs={positions ? [...TICKS_BEFORE, ...TICKS_AFTER] : TICKS_BEFORE} />
      {positions && TICKS_BEFORE.map((x) => <circle key={x} className={styles.dot} cx={x} cy={46} r={3} />)}
      <g className={styles.grow}>
        <rect className={styles.fillOk} x={74} y={y} width={76} height={6} rx={3} />
        <rect className={styles.fillBad} x={150} y={y} width={52} height={6} rx={3} />
      </g>
      <path className={styles.threshold} d="M150 26V84" />
      <text className={styles.thresholdLabel} x={153} y={32}>
        {t("diagram.threshold")}
      </text>
      <text className={styles.label} x={10} y={94}>
        {t(positions ? "diagram.messagesContinuous" : "diagram.messages")}
      </text>
      <text className={styles.label} x={positions ? 10 : 76} y={34}>
        {t(positions ? "diagram.positions" : "diagram.silence")}
      </text>
      <text className={`${styles.alert} ${styles.pop}`} x={188} y={positions ? 38 : 35}>
        !
      </text>
    </>
  );
}

/** R3 and R4: a value that changes faster than the threshold slope allows. */
function Slope({ t, altitude }: { t: Translate; altitude: boolean }) {
  const steady = altitude ? "M14 76L60 71 96 67" : "M14 30L60 28 100 27";
  const jump = altitude ? "M96 67L126 24" : "M100 27L124 66";
  const after = altitude ? "M126 24L162 20 206 18" : "M124 66L162 69 206 71";
  const limit = altitude ? "M96 67L150 44" : "M100 27L150 44";
  return (
    <>
      <path className={styles.axis} d="M12 8V88H212" />
      <path className={styles.threshold} d={limit} />
      <text className={styles.thresholdLabel} x={153} y={47}>
        {t("diagram.slope")}
      </text>
      <path className={styles.ok} d={steady} />
      <path className={`${styles.bad} ${styles.late}`} pathLength={1} d={jump} />
      <path className={`${styles.ok} ${styles.pop}`} d={after} />
      <text className={styles.label} x={16} y={14}>
        {t(altitude ? "diagram.altitude" : "diagram.speed")}
      </text>
      <text className={styles.label} x={186} y={97}>
        {t("diagram.time")}
      </text>
    </>
  );
}

/** R5: a turn tighter than the threshold allows. */
function Turn({ t }: { t: Translate }) {
  return (
    <>
      <path className={styles.threshold} d="M92 80Q150 80 196 46" />
      <text className={styles.thresholdLabel} x={150} y={88}>
        {t("diagram.turnThreshold")}
      </text>
      <path className={styles.ok} d="M14 80H92" />
      <path className={`${styles.bad} ${styles.late}`} pathLength={1} d="M92 80Q122 80 128 50" />
      <path className={`${styles.ok} ${styles.pop}`} d="M128 50L138 16" />
      <g className={styles.pop} transform="translate(138 16) rotate(16) scale(.55)">
        <path className={styles.badPlane} d={AIRCRAFT_SILHOUETTE} />
      </g>
      <g transform="translate(14 80) rotate(90) scale(.5)">
        <path className={styles.ghostPlane} d={AIRCRAFT_SILHOUETTE} />
      </g>
      <text className={styles.label} x={14} y={96}>
        {t("diagram.initialHeading")}
      </text>
      <text className={styles.label} x={146} y={22}>
        {t("diagram.newHeading")}
      </text>
    </>
  );
}

/**
 * A small animated drawing of what a rule measures and where its threshold falls. With
 * reduced motion, it shows its final state.
 */
export default function RuleDiagram({ code, className }: RuleDiagramProps) {
  const { t } = useTranslation();
  let drawing: ReactNode;
  switch (code) {
    case "R1":
      drawing = <Silence t={t} positions={false} />;
      break;
    case "R2":
      drawing = <Silence t={t} positions />;
      break;
    case "R3":
      drawing = <Slope t={t} altitude />;
      break;
    case "R4":
      drawing = <Slope t={t} altitude={false} />;
      break;
    case "R5":
      drawing = <Turn t={t} />;
      break;
    default:
      return null;
  }
  return (
    <svg
      className={[styles.diagram, className].filter(Boolean).join(" ")}
      viewBox="0 0 220 100"
      role="img"
      aria-label={t("diagram.label", { code })}
    >
      {drawing}
    </svg>
  );
}

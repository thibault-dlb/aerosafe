import styles from "./HomeVignettes.module.css";

export type VignetteKind = "aircraft" | "alerts" | "rules" | "replay";

const ALERT_ROWS = [
  { rule: "R3", level: "danger", width: 150 },
  { rule: "R5", level: "warning", width: 118 },
  { rule: "R1", level: "warning", width: 136 },
] as const;

const SLIDERS = [
  { rule: "R3", fill: 0.62 },
  { rule: "R4", fill: 0.35 },
  { rule: "R5", fill: 0.78 },
] as const;

/** A small drawing of what a feature looks like: decorative, the text next to it says it all. */
export default function HomeVignette({ kind }: { kind: VignetteKind }) {
  return (
    <svg className={styles.vignette} viewBox="0 0 320 200" aria-hidden="true" focusable="false">
      <rect className={styles.frame} x="1" y="1" width="318" height="198" rx="12" />
      {kind === "aircraft" && (
        <>
          <path className={styles.grid} d="M20 60H300M20 100H300M20 140H300M80 20V180M160 20V180M240 20V180" />
          <path className={styles.trail} d="M30 150C80 140 110 90 160 80S240 50 292 40" />
          <path className={styles.gap} d="M160 80C185 74 205 70 225 62" />
          <circle className={styles.dot} cx="292" cy="40" r="6" />
          <rect className={styles.chip} x="30" y="26" width="86" height="22" rx="11" />
          <text className={styles.mono} x="73" y="41" textAnchor="middle">
            3944EE
          </text>
        </>
      )}
      {kind === "alerts" && (
        <>
          {ALERT_ROWS.map((row, index) => (
            <g key={row.rule} transform={`translate(24 ${28 + index * 50})`}>
              <rect className={styles.row} width="272" height="38" rx="8" />
              <circle className={row.level === "danger" ? styles.danger : styles.warning} cx="20" cy="19" r="6" />
              <text className={styles.mono} x="38" y="23">
                {row.rule}
              </text>
              <rect className={styles.bar} x="74" y="15" width={row.width} height="8" rx="4" />
            </g>
          ))}
        </>
      )}
      {kind === "rules" && (
        <>
          {SLIDERS.map((slider, index) => (
            <g key={slider.rule} transform={`translate(28 ${40 + index * 48})`}>
              <text className={styles.mono} x="0" y="5">
                {slider.rule}
              </text>
              <rect className={styles.track} x="40" y="0" width="236" height="6" rx="3" />
              <rect className={styles.fill} x="40" y="0" width={236 * slider.fill} height="6" rx="3" />
              <circle className={styles.knob} cx={40 + 236 * slider.fill} cy="3" r="9" />
            </g>
          ))}
        </>
      )}
      {kind === "replay" && (
        <>
          <text className={styles.clock} x="160" y="78" textAnchor="middle">
            14:32 UTC
          </text>
          <rect className={styles.track} x="30" y="108" width="260" height="6" rx="3" />
          <rect className={styles.fill} x="30" y="108" width="150" height="6" rx="3" />
          <circle className={styles.knob} cx="180" cy="111" r="9" />
          {["×1", "×10", "×60"].map((speed, index) => (
            <g key={speed} transform={`translate(${96 + index * 52} 138)`}>
              <rect className={index === 2 ? styles.chipOn : styles.chip} width="44" height="24" rx="12" />
              <text className={styles.mono} x="22" y="16" textAnchor="middle">
                {speed}
              </text>
            </g>
          ))}
        </>
      )}
    </svg>
  );
}

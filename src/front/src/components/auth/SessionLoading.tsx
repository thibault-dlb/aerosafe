import { useTranslation } from "@/hooks/useTranslation";

import styles from "./SessionLoading.module.css";

/**
 * Shown while the API says whether a session is kept for this browser. The eye of the logo is
 * drawn in gold, then its pupil, a radar, starts to sweep.
 */
export default function SessionLoading() {
  const { t } = useTranslation();
  return (
    <main className={styles.loading}>
      <svg className={styles.eye} viewBox="0 0 120 92" aria-hidden="true" focusable="false">
        <path className={styles.ink} pathLength={1} d="M6 24Q58 -8 116 20" />
        <path className={`${styles.ink} ${styles.second}`} pathLength={1} d="M12 42Q60 6 108 42Q60 70 12 42Z" />
        <path className={`${styles.ink} ${styles.third}`} pathLength={1} d="M50 62L46 84" />
        <path
          className={`${styles.ink} ${styles.fourth}`}
          pathLength={1}
          d="M68 61Q80 88 100 78Q110 71 103 63Q95 58 92 66"
        />
        <g className={styles.pupil}>
          <circle className={styles.iris} cx={60} cy={40} r={13} />
          <circle className={styles.grid} cx={60} cy={40} r={6.5} />
          <path className={styles.grid} d="M47 40h26M60 27v26" />
          <path className={styles.sweep} d="M60 40L60 27A13 13 0 0 0 49.5 32.4Z" opacity={0.55} />
        </g>
      </svg>
      <p role="status">{t("auth.loading")}</p>
    </main>
  );
}

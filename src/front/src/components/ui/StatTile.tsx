import type { ReactNode } from "react";

import styles from "./StatTile.module.css";

export interface StatTileProps {
  label: string;
  value: ReactNode;
  /** Small text under the value, for example a period. */
  hint?: string;
}

/** One figure with its label. The value is set in the data font. */
export default function StatTile({ label, value, hint }: StatTileProps) {
  return (
    <dl className={styles.tile}>
      <dt className={styles.label}>{label}</dt>
      <dd className={`${styles.value} mono`}>{value}</dd>
      {hint && <dd className={styles.hint}>{hint}</dd>}
    </dl>
  );
}

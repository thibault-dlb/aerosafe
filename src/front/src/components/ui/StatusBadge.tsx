import styles from "./StatusBadge.module.css";
import type { StatusLevel } from "./StatusLevel";

export interface StatusBadgeProps {
  level: StatusLevel;
  /** Always shown: the level is never carried by the colour and the shape alone. */
  label: string;
}

/** A state with a shape, a colour and a label (NF-03). */
export default function StatusBadge({ level, label }: StatusBadgeProps) {
  return <span className={`${styles.badge} ${styles[level]}`}>{label}</span>;
}

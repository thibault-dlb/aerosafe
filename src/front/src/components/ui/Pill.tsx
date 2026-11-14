import type { ReactNode } from "react";

import Icon from "./Icon";
import styles from "./Pill.module.css";

export type PillTone = "neutral" | "active" | "open" | "done" | "air";

export interface PillProps {
  /**
   * `active`: something is going on (a dot that pulses). `open`: waiting for someone (a hollow
   * dot). `done`: finished (a check). `air`: a normal, good state. `neutral`: anything else.
   */
  tone?: PillTone;
  children: ReactNode;
}

/** A short state of an item, always with its word: the dot or the check only adds to it. */
export default function Pill({ tone = "neutral", children }: PillProps) {
  return (
    <span className={`${styles.pill} ${styles[tone]}`}>
      {tone === "done" ? <Icon name="check" size={12} /> : <i className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  );
}

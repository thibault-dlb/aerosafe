import type { ReactNode } from "react";

import styles from "./Fold.module.css";

export interface FoldProps {
  open: boolean;
  children: ReactNode;
}

/** Content that unfolds in height. While closed it is hidden from the keyboard and from screen readers. */
export default function Fold({ open, children }: FoldProps) {
  return (
    <div className={[styles.fold, open && styles.open].filter(Boolean).join(" ")}>
      <div className={styles.inner} inert={!open} aria-hidden={!open}>
        {children}
      </div>
    </div>
  );
}

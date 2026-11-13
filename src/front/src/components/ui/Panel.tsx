import type { ReactNode } from "react";
import { useId } from "react";

import styles from "./Panel.module.css";

export interface PanelProps {
  /** Heading of the panel. It also names the region for screen readers. */
  title?: string;
  children: ReactNode;
  className?: string;
}

/** A framed block of the page, with an optional heading. */
export default function Panel({ title, children, className }: PanelProps) {
  const headingId = useId();
  return (
    <section
      className={[styles.panel, className].filter(Boolean).join(" ")}
      aria-labelledby={title ? headingId : undefined}
    >
      {title && (
        <h2 id={headingId} className={styles.title}>
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

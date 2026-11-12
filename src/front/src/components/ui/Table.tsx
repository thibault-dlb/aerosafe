import type { ReactNode } from "react";

import styles from "./Table.module.css";

export interface TableProps {
  /** `<caption>`, `<thead>` and `<tbody>`. Mark the selected row with `aria-selected="true"`. */
  children: ReactNode;
}

/** A styled table. It scrolls sideways on a narrow screen instead of widening the page. */
export default function Table({ children }: TableProps) {
  return (
    <div className={styles.scroll}>
      <table className={styles.table}>{children}</table>
    </div>
  );
}

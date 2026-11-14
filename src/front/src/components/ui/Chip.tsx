import type { ButtonHTMLAttributes, ReactNode } from "react";

import styles from "./Chip.module.css";

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed"> {
  /** Whether the filter is on. Announced to screen readers. */
  pressed: boolean;
  /** Optional number of results behind the filter. */
  count?: number;
  children: ReactNode;
}

/** A filter that is switched on and off with one click. */
export default function Chip({ pressed, count, children, className, type = "button", ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={[styles.chip, className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
      {count !== undefined && <span className={styles.count}>{count}</span>}
    </button>
  );
}

import type { ButtonHTMLAttributes, ReactNode } from "react";

import styles from "./Switch.module.css";

export interface SwitchProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "role" | "aria-checked" | "onChange" | "children"> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** What the switch controls, shown beside it. It also names the switch for screen readers. */
  children: ReactNode;
}

/** An on/off switch, for a setting that applies as soon as it is flipped or is saved with its form. */
export default function Switch({ checked, onChange, children, className, type = "button", ...rest }: SwitchProps) {
  return (
    <button
      type={type}
      role="switch"
      aria-checked={checked}
      className={[styles.switch, className].filter(Boolean).join(" ")}
      onClick={() => onChange(!checked)}
      {...rest}
    >
      <span className={styles.track} aria-hidden="true" />
      <span className={styles.label}>{children}</span>
    </button>
  );
}

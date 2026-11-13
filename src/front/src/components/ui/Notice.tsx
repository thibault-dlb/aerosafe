import type { ReactNode } from "react";

import styles from "./Notice.module.css";

export type NoticeVariant = "info" | "warning" | "danger";

export interface NoticeProps {
  variant?: NoticeVariant;
  children: ReactNode;
  className?: string;
}

/** A message in a box. Warnings and errors are announced to screen readers at once. */
export default function Notice({ variant = "info", children, className }: NoticeProps) {
  const classNames = [styles.notice, variant !== "info" && styles[variant], className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classNames} role={variant === "info" ? "status" : "alert"}>
      {children}
    </div>
  );
}

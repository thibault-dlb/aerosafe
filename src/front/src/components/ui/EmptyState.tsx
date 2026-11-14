import type { ReactNode } from "react";

import styles from "./EmptyState.module.css";

export type EmptyKind = "alerts" | "results" | "flights" | "stopped";

export interface EmptyStateProps {
  /** Which small radar scene to draw. */
  kind: EmptyKind;
  title: string;
  /** One sentence that says why the list is empty and what to do. */
  children: ReactNode;
  /** An optional action, usually a button. */
  action?: ReactNode;
}

function Radar({ turning }: { turning: boolean }) {
  return (
    <>
      <circle className={styles.rim} cx="60" cy="60" r="56" />
      <circle className={styles.ring} cx="60" cy="60" r="20" />
      <circle className={styles.ring} cx="60" cy="60" r="38" />
      <path className={styles.cross} d="M60 4v112M4 60h112" />
      <path className={[styles.beam, !turning && styles.still].filter(Boolean).join(" ")} d="M60 60L60 4A56 56 0 0 1 99.6 20.4Z" />
      <path className={[styles.edge, !turning && styles.still].filter(Boolean).join(" ")} d="M60 60V4" />
    </>
  );
}

function Scene({ kind }: { kind: EmptyKind }) {
  switch (kind) {
    case "alerts":
      return (
        <>
          <Radar turning />
          <path className={styles.good} d="M43 61l12 12 22-25" />
        </>
      );
    case "results":
      return (
        <>
          <Radar turning />
          <text className={styles.question} x="60" y="70" textAnchor="middle">
            ?
          </text>
        </>
      );
    case "flights":
      return (
        <>
          <circle className={styles.rim} cx="60" cy="60" r="56" />
          <path className={styles.cross} d="M60 4v112M4 60h112" />
          <path className={styles.route} d="M24 82Q60 14 96 82" />
          <circle className={styles.airport} cx="24" cy="82" r="5" />
          <circle className={styles.airport} cx="96" cy="82" r="5" />
        </>
      );
    case "stopped":
      return (
        <>
          <Radar turning={false} />
          <rect className={styles.pause} x="50" y="46" width="7" height="28" rx="2" />
          <rect className={styles.pause} x="63" y="46" width="7" height="28" rx="2" />
        </>
      );
  }
}

/** What a list or a map shows when it has nothing to show: a small radar scene, a title and a sentence. */
export default function EmptyState({ kind, title, children, action }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <svg className={styles.scene} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <Scene kind={kind} />
      </svg>
      <p className={styles.title}>{title}</p>
      <p className={styles.text}>{children}</p>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

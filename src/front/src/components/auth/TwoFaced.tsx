import type { ReactNode } from "react";

import styles from "./TwoFaced.module.css";

/** The two modes of the log in screen. */
export type AuthMode = "login" | "signup";

export interface TwoFacedProps {
  mode: AuthMode;
  login: ReactNode;
  signup: ReactNode;
}

/**
 * Both texts sit in the same place and the one of the current mode fades in as the other fades
 * out, so the form can turn from one mode into the other without jumping. The one that is not
 * shown is hidden from the keyboard and from screen readers.
 */
export default function TwoFaced({ mode, login, signup }: TwoFacedProps) {
  const face = (active: boolean, content: ReactNode) => (
    <span className={active ? undefined : styles.hidden} inert={!active} aria-hidden={!active}>
      {content}
    </span>
  );
  return (
    <span className={styles.stack}>
      {face(mode === "login", login)}
      {face(mode === "signup", signup)}
    </span>
  );
}

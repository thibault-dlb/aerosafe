import styles from "./Dashboard.module.css";

/** The class that colours a rule: R1 to R5 have their own colour, a later rule the neutral one. */
export function ruleClass(code: string): string {
  return /^R[1-5]$/.test(code) ? styles[`rule${code.slice(1)}`] : styles.ruleOther;
}

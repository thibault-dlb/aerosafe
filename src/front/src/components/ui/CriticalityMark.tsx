import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/fr";
import type { Criticality } from "@/models/Alert";

import styles from "./CriticalityMark.module.css";

export type CriticalityVariant = "mark" | "label" | "badge";

export interface CriticalityMarkProps {
  /** The criticality of an alert or of a rule; `null` when it has none. */
  level: Criticality | null;
  /**
   * `mark`: the shape alone, named for screen readers. `label`: the shape and its word.
   * `badge`: the same in a pill, for a detail view.
   */
  variant?: CriticalityVariant;
  className?: string;
}

const LABELS: Record<Criticality | "NONE", TranslationKey> = {
  HIGH: "criticality.high",
  MEDIUM: "criticality.medium",
  LOW: "criticality.low",
  NONE: "criticality.none",
};

const SHAPES: Record<Criticality | "NONE", string> = {
  HIGH: "M6 .5 11.5 6 6 11.5.5 6Z",
  MEDIUM: "M6 1 11.5 11H.5Z",
  LOW: "",
  NONE: "M2.5 6h7",
};

/**
 * The criticality as a shape and a colour (NF-03): a filled diamond for high, a filled
 * triangle for medium, a hollow circle for low and a dash for none. The shape carries the
 * meaning, so it stays readable without the colour.
 */
export default function CriticalityMark({ level, variant = "mark", className }: CriticalityMarkProps) {
  const { t } = useTranslation();
  const key = level ?? "NONE";
  const word = t(LABELS[key]);
  const named = variant === "mark";
  const classNames = [styles.root, variant !== "mark" && styles[variant], styles[key.toLowerCase()], className]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={classNames} role={named ? "img" : undefined} aria-label={named ? t("criticality.label", { level: word }) : undefined}>
      <svg className={styles.shape} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
        {key === "LOW" ? <circle cx="6" cy="6" r="4" /> : <path d={SHAPES[key]} />}
      </svg>
      {variant !== "mark" && <span className={styles.word}>{word}</span>}
    </span>
  );
}

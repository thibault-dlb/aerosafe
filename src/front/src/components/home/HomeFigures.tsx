import { useCountUp } from "@/hooks/useCountUp";
import { useReveal } from "@/hooks/useReveal";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/fr";

import { FIGURES } from "./figures";
import styles from "./HomeFigures.module.css";

function Figure({ value, unit, label, active }: { value: number; unit: string; label: TranslationKey; active: boolean }) {
  const { t, language } = useTranslation();
  const shown = useCountUp(value, active);
  return (
    <li className={styles.figure}>
      <p className={styles.value}>
        <span aria-hidden="true">{new Intl.NumberFormat(language, { maximumFractionDigits: 0 }).format(shown)}</span>
        <span className="visually-hidden">{new Intl.NumberFormat(language).format(value)}</span>
        {unit && <small>{unit}</small>}
      </p>
      <p className={styles.label}>{t(label)}</p>
    </li>
  );
}

/** Four figures that count up when the section comes into view. */
export default function HomeFigures() {
  const { t } = useTranslation();
  const [ref, seen] = useReveal<HTMLElement>(0.35);
  return (
    <section ref={ref} className={styles.section} aria-label={t("home.figures.label")}>
      <ul className={styles.list}>
        {FIGURES.map((figure) => (
          <Figure key={figure.label} {...figure} active={seen} />
        ))}
      </ul>
    </section>
  );
}

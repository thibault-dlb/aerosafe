import { useReveal } from "@/hooks/useReveal";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/fr";

import styles from "./HomeSteps.module.css";

const STEPS: { title: TranslationKey; text: TranslationKey }[] = [
  { title: "home.steps.collect.title", text: "home.steps.collect.text" },
  { title: "home.steps.detect.title", text: "home.steps.detect.text" },
  { title: "home.steps.alert.title", text: "home.steps.alert.text" },
  { title: "home.steps.analyse.title", text: "home.steps.analyse.text" },
];

/** How it works: collect, detect, alert, analyse. A line fills and the steps light up one by one. */
export default function HomeSteps() {
  const { t } = useTranslation();
  const [ref, seen] = useReveal<HTMLOListElement>(0.3);
  return (
    <section className={styles.section} aria-labelledby="home-steps-title">
      <h2 id="home-steps-title" className={styles.title}>
        {t("home.steps.title")}
      </h2>
      <ol ref={ref} className={`${styles.list} ${seen ? styles.seen : ""}`}>
        {STEPS.map((step, index) => (
          <li key={step.title} className={styles.step} style={{ transitionDelay: `${index * 0.45}s` }}>
            <span className={styles.number} aria-hidden="true">
              {index + 1}
            </span>
            <h3>{t(step.title)}</h3>
            <p>{t(step.text)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

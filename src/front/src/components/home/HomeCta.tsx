import { ButtonLink } from "@/components/ui/Button";
import { useReveal } from "@/hooks/useReveal";
import { useTranslation } from "@/hooks/useTranslation";

import styles from "./HomeCta.module.css";

/** Closing band of the home page: the two ways into the application. */
export default function HomeCta() {
  const { t } = useTranslation();
  const [ref, seen] = useReveal<HTMLElement>(0.3);
  return (
    <section ref={ref} className={`${styles.section} ${seen ? styles.seen : ""}`} aria-labelledby="home-cta-title">
      <h2 id="home-cta-title" className={styles.title}>
        {t("home.cta.title")}
      </h2>
      <p className={styles.text}>{t("home.cta.text")}</p>
      <div className={styles.actions}>
        <ButtonLink to="/dashboard">{t("home.cta.dashboard")}</ButtonLink>
        <ButtonLink to="/login" variant="secondary">
          {t("home.cta.login")}
        </ButtonLink>
      </div>
    </section>
  );
}

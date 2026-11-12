import logoUrl from "@/assets/logo/aerosafe-logo.svg";
import { ButtonLink } from "@/components/ui/Button";
import { useTranslation } from "@/hooks/useTranslation";

import styles from "./HomeHero.module.css";

/** Top of the home page: the logo, the name, what the application does and the first steps. */
export default function HomeHero() {
  const { t } = useTranslation();
  return (
    <section className={styles.hero}>
      <img className={styles.logo} src={logoUrl} alt="" />
      <div className={styles.text}>
        <h1 className={styles.title}>AeroSafe</h1>
        <p className={styles.tagline}>{t("home.tagline")}</p>
        <p className={styles.pitch}>{t("home.pitch")}</p>
        <div className={styles.actions}>
          <ButtonLink to="/login">{t("home.cta.login")}</ButtonLink>
          <ButtonLink to="/aircraft" variant="secondary">
            {t("home.cta.search")}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

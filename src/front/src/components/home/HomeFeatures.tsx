import { Link } from "react-router-dom";

import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/fr";

import styles from "./HomeFeatures.module.css";

const FEATURES: { to: string; title: TranslationKey; text: TranslationKey }[] = [
  { to: "/aircraft", title: "nav.aircraft", text: "home.features.aircraft" },
  { to: "/dashboard", title: "nav.dashboard", text: "home.features.dashboard" },
  { to: "/alerts", title: "nav.alerts", text: "home.features.alerts" },
  { to: "/rules", title: "nav.rules", text: "home.features.rules" },
];

/** Cards that lead to the main screens. */
export default function HomeFeatures() {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="home-features-title">
      <h2 id="home-features-title">{t("home.features.title")}</h2>
      <ul className={styles.grid}>
        {FEATURES.map((feature) => (
          <li key={feature.to}>
            <Link to={feature.to} className={styles.card}>
              <h3>{t(feature.title)}</h3>
              <p>{t(feature.text)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

import { Link } from "react-router-dom";

import { useReveal } from "@/hooks/useReveal";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/fr";

import styles from "./HomeFeatures.module.css";
import HomeVignette, { type VignetteKind } from "./HomeVignettes";

interface Feature {
  kind: VignetteKind;
  to: string;
  title: TranslationKey;
  text: TranslationKey;
  link: TranslationKey;
}

const FEATURES: Feature[] = [
  { kind: "aircraft", to: "/aircraft", title: "home.features.aircraft.title", text: "home.features.aircraft.text", link: "home.features.aircraft.link" },
  { kind: "alerts", to: "/alerts", title: "home.features.alerts.title", text: "home.features.alerts.text", link: "home.features.alerts.link" },
  { kind: "rules", to: "/rules", title: "home.features.rules.title", text: "home.features.rules.text", link: "home.features.rules.link" },
  { kind: "replay", to: "/dashboard", title: "home.features.replay.title", text: "home.features.replay.text", link: "home.features.replay.link" },
];

function FeatureRow({ feature, flipped }: { feature: Feature; flipped: boolean }) {
  const { t } = useTranslation();
  const [ref, seen] = useReveal<HTMLLIElement>(0.25);
  const classes = [styles.row, flipped && styles.flipped, seen && styles.seen].filter(Boolean).join(" ");
  return (
    <li ref={ref} className={classes}>
      <div className={styles.art}>
        <HomeVignette kind={feature.kind} />
      </div>
      <div className={styles.copy}>
        <h3>{t(feature.title)}</h3>
        <p>{t(feature.text)}</p>
        <Link to={feature.to} className={styles.link}>
          {t(feature.link)} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </li>
  );
}

/** What the application does, one row per feature, each leading to its page. */
export default function HomeFeatures() {
  const { t } = useTranslation();
  return (
    <section className={styles.section} aria-labelledby="home-features-title">
      <p className={styles.eyebrow}>{t("home.features.eyebrow")}</p>
      <h2 id="home-features-title" className={styles.title}>
        {t("home.features.title")}
      </h2>
      <ul className={styles.list}>
        {FEATURES.map((feature, index) => (
          <FeatureRow key={feature.to + feature.kind} feature={feature} flipped={index % 2 === 1} />
        ))}
      </ul>
    </section>
  );
}

import HomeFeatures from "@/components/home/HomeFeatures";
import HomeHero from "@/components/home/HomeHero";
import Notice from "@/components/ui/Notice";
import { useTranslation } from "@/hooks/useTranslation";

import styles from "./Home.module.css";

/** Home page: presentation, educational disclaimer (§VII.3) and the main screens. */
export default function Home() {
  const { t } = useTranslation();
  return (
    <main className={styles.page}>
      <HomeHero />
      <Notice>{t("home.disclaimer")}</Notice>
      <HomeFeatures />
    </main>
  );
}

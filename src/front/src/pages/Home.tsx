import HomeFeatures from "@/components/home/HomeFeatures";
import HomeHero from "@/components/home/HomeHero";
import HomeLive from "@/components/home/HomeLive";
import Notice from "@/components/ui/Notice";
import { useTranslation } from "@/hooks/useTranslation";
import type { HomeOverviewService } from "@/services/HomeOverviewService";

import styles from "./Home.module.css";

export interface HomeProps {
  /** Where the live figures come from. Tests give their own. */
  overview?: HomeOverviewService;
}

/** Home page: presentation, educational disclaimer (§VII.3), live figures and the main screens. */
export default function Home({ overview }: HomeProps) {
  const { t } = useTranslation();
  return (
    <main className={styles.page}>
      <HomeHero />
      <Notice>{t("home.disclaimer")}</Notice>
      <HomeLive service={overview} />
      <HomeFeatures />
    </main>
  );
}

import HomeCta from "@/components/home/HomeCta";
import HomeFeatures from "@/components/home/HomeFeatures";
import HomeFigures from "@/components/home/HomeFigures";
import HomeHero from "@/components/home/HomeHero";
import HomeSteps from "@/components/home/HomeSteps";

import styles from "./Home.module.css";

/** Home page: the scroll-driven scene, what the application does, its figures, how it works, then the way in. */
export default function Home() {
  return (
    <main className={styles.page}>
      <HomeHero />
      <HomeFeatures />
      <HomeFigures />
      <HomeSteps />
      <HomeCta />
    </main>
  );
}

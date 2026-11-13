import HomeFeatures from "@/components/home/HomeFeatures";
import HomeHero from "@/components/home/HomeHero";

import styles from "./Home.module.css";

/** Home page: presentation, the main screens. */
export default function Home() {
  return (
    <main className={styles.page}>
      <HomeHero />
      <HomeFeatures />
    </main>
  );
}

import { Link, Outlet, useLocation } from "react-router-dom";

import logoUrl from "@/assets/logo/aerosafe-logo.svg";
import DataModeSwitch from "@/components/layout/DataModeSwitch";
import LanguageSwitch from "@/components/layout/LanguageSwitch";
import ThemeSwitch from "@/components/layout/ThemeSwitch";
import ReplayBar from "@/components/replay/ReplayBar";
import { ButtonLink } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useDataMode } from "@/hooks/useDataMode";
import { useScrolled } from "@/hooks/useScrolled";
import { useTranslation } from "@/hooks/useTranslation";
import ReplayProvider from "@/providers/ReplayProvider";

import styles from "./AppLayout.module.css";

/**
 * The frame of the pages that are not part of the application: the home page, and the page for
 * an address that leads nowhere. A bar with the logo, the choices of the visitor and the way in,
 * the page, then the footer. The pages of the application have their own frame, `AppShell`.
 */
export default function AppLayout() {
  const { t } = useTranslation();
  const { status } = useAuth();
  const { mode } = useDataMode();
  // The landing page is always dark, edge to edge, under a bar that is clear until it scrolls.
  const { pathname } = useLocation();
  const landing = pathname === "/";
  const scrolled = useScrolled();
  const frameClass = landing ? `${styles.frame} ${styles.landing} darkScope` : styles.frame;
  // In the replay the bar stays in the flow, so the replay bar under it is not covered.
  const overlay = landing && mode !== "replay";
  const barClass = [styles.bar, overlay && styles.overlay, overlay && scrolled && styles.barSolid]
    .filter(Boolean)
    .join(" ");

  return (
    <ReplayProvider>
      <div className={frameClass}>
        <a className={styles.skip} href="#content">
          {t("layout.skipToContent")}
        </a>
        <header className={barClass}>
          <Link to="/" className={styles.brand}>
            <img className={styles.logo} src={logoUrl} alt="" width={40} height={40} />
            <span className={styles.name}>AeroSafe</span>
          </Link>

          <div className={styles.controls}>
            <DataModeSwitch />
            <LanguageSwitch />
            <ThemeSwitch />
            {status === "authenticated" ? (
              <ButtonLink to="/dashboard">{t("shell.openApp")}</ButtonLink>
            ) : (
              <ButtonLink to="/login" variant="secondary">
                {t("nav.login")}
              </ButtonLink>
            )}
          </div>
        </header>

        {mode === "replay" && <ReplayBar />}

        {/* The key remounts the page when the mode changes, so it loads the data of the new mode. */}
        <div id="content" key={mode} className={styles.content}>
          <Outlet />
        </div>

        <footer className={styles.footer}>
          <p>{t("footer.disclaimer")}</p>
          <p>{t("footer.data")}</p>
        </footer>
      </div>
    </ReplayProvider>
  );
}

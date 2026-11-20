import { Link, Outlet, useLocation } from "react-router-dom";

import logoUrl from "@/assets/logo/aerosafe-logo.svg";
import LanguageSwitch from "@/components/layout/LanguageSwitch";
import { ButtonLink } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useScrolled } from "@/hooks/useScrolled";
import { useTranslation } from "@/hooks/useTranslation";
import DataCredits from "@/components/layout/DataCredits";

import styles from "./AppLayout.module.css";

/**
 * The frame of the pages that are not part of the application: the home page, and the page for
 * an address that leads nowhere. A bar with the logo, the choices of the visitor and the way in,
 * the page, then the footer. The pages of the application have their own frame, `AppShell`.
 */
export default function AppLayout() {
  const { t } = useTranslation();
  const { status } = useAuth();
  // The landing page runs edge to edge, under a bar that is clear until it scrolls.
  const { pathname } = useLocation();
  const landing = pathname === "/";
  const scrolled = useScrolled();
  const frameClass = landing ? `${styles.frame} ${styles.landing}` : styles.frame;
  const barClass = [styles.bar, landing && styles.overlay, landing && scrolled && styles.barSolid]
    .filter(Boolean)
    .join(" ");

  return (
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
          <LanguageSwitch />
          {status === "authenticated" ? (
            <ButtonLink to="/dashboard">{t("shell.openApp")}</ButtonLink>
          ) : (
            <ButtonLink to="/login" variant="secondary">
              {t("nav.login")}
            </ButtonLink>
          )}
        </div>
      </header>

      <div id="content" className={styles.content}>
        <Outlet />
      </div>

      <footer className={styles.footer}>
        <p>{t("footer.disclaimer")}</p>
        <DataCredits />
      </footer>
    </div>
  );
}

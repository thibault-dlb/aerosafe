import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import logoUrl from "@/assets/logo/aerosafe-logo.svg";
import ReplayBar from "@/components/replay/ReplayBar";
import Notice from "@/components/ui/Notice";
import { useDataMode } from "@/hooks/useDataMode";
import { useScrolled } from "@/hooks/useScrolled";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/fr";
import ReplayProvider from "@/providers/ReplayProvider";
import { DATA_MODES } from "@/services/DataModeService";
import { LANGUAGES } from "@/services/TranslationService";

import styles from "./AppLayout.module.css";

const LINKS: { to: string; label: TranslationKey }[] = [
  { to: "/aircraft", label: "nav.aircraft" },
  { to: "/dashboard", label: "nav.dashboard" },
  { to: "/alerts", label: "nav.alerts" },
  { to: "/rules", label: "nav.rules" },
  { to: "/admin/accounts", label: "nav.accounts" },
  { to: "/login", label: "nav.login" },
];

const NAV_ID = "main-links";

/** Pages where the visitor is about to use the data: they carry the educational notice. */
const NOTICE_PATHS = ["/login", "/signup"];

/** Shared page frame: the top bar with the navigation, the current page, then the footer. */
export default function AppLayout() {
  const { t, language, setLanguage } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { mode, setMode } = useDataMode();
  const [menuOpen, setMenuOpen] = useState(false);
  // The landing page is always dark, edge to edge, under a bar that is clear until it scrolls.
  const { pathname } = useLocation();
  const landing = pathname === "/";
  const scrolled = useScrolled();
  const frameClass = landing ? `${styles.frame} ${styles.landing} darkScope` : styles.frame;
  const barClass = landing && (scrolled || menuOpen) ? `${styles.bar} ${styles.barSolid}` : styles.bar;

  return (
    <ReplayProvider>
      <div className={frameClass}>
        <a className={styles.skip} href="#content">
          {t("layout.skipToContent")}
        </a>
        <header className={barClass}>
          <Link to="/" className={styles.brand} onClick={() => setMenuOpen(false)}>
            <img className={styles.logo} src={logoUrl} alt="" width={40} height={40} />
            <span className={styles.name}>AeroSafe</span>
          </Link>

          <button
            type="button"
            className={styles.menuButton}
            aria-expanded={menuOpen}
            aria-controls={NAV_ID}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
          </button>

          <nav aria-label={t("nav.main")} className={styles.nav}>
            <ul id={NAV_ID} className={`${styles.links} ${menuOpen ? styles.open : ""}`}>
              {LINKS.map((link) => (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    className={({ isActive }) => (isActive ? styles.active : undefined)}
                    onClick={() => setMenuOpen(false)}
                  >
                    {t(link.label)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.controls}>
            <div role="group" aria-label={t("mode.label")} className={styles.group}>
              {DATA_MODES.map((code) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={mode === code}
                  onClick={() => setMode(code)}
                >
                  {t(code === "live" ? "mode.live" : "mode.replay")}
                </button>
              ))}
            </div>
            <div role="group" aria-label={t("language.label")} className={styles.group}>
              {LANGUAGES.map((code) => (
                <button
                  key={code}
                  type="button"
                  lang={code}
                  aria-label={t(code === "fr" ? "language.fr" : "language.en")}
                  aria-pressed={language === code}
                  onClick={() => setLanguage(code)}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={styles.themeButton}
              aria-label={t(theme === "dark" ? "theme.toLight" : "theme.toDark")}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
            </button>
          </div>
        </header>

        {mode === "replay" && <ReplayBar />}

        {/* The key remounts the page when the mode changes, so it loads the data of the new mode. */}
        <div id="content" key={mode} className={styles.content}>
          {NOTICE_PATHS.includes(pathname) && <Notice className={styles.notice}>{t("layout.disclaimer")}</Notice>}
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

import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import logoUrl from "@/assets/logo/aerosafe-logo.svg";
import LanguageSwitch from "@/components/layout/LanguageSwitch";
import ReplayBar from "@/components/replay/ReplayBar";
import Icon from "@/components/ui/Icon";
import Notice from "@/components/ui/Notice";
import { useAuth } from "@/hooks/useAuth";
import { useDataMode } from "@/hooks/useDataMode";
import { useScrolled } from "@/hooks/useScrolled";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/fr";
import ReplayProvider from "@/providers/ReplayProvider";
import { DATA_MODES } from "@/services/DataModeService";

import styles from "./AppLayout.module.css";

const LINKS: { to: string; label: TranslationKey }[] = [
  { to: "/aircraft", label: "nav.aircraft" },
  { to: "/dashboard", label: "nav.dashboard" },
  { to: "/alerts", label: "nav.alerts" },
  { to: "/rules", label: "nav.rules" },
  { to: "/admin/accounts", label: "nav.accounts" },
];

const NAV_ID = "main-links";

/** Shared page frame: the top bar with the navigation, the current page, then the footer. */
export default function AppLayout() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { status, logout } = useAuth();
  const navigate = useNavigate();
  const { mode, setMode } = useDataMode();
  const [menuOpen, setMenuOpen] = useState(false);
  // The landing page is always dark, edge to edge, under a bar that is clear until it scrolls.
  const { pathname, state } = useLocation();
  // A new account is welcomed once, on the first page it opens: the mark is removed from the history.
  const [welcome, setWelcome] = useState(() => (state as { welcome?: boolean } | null)?.welcome === true);
  useEffect(() => {
    if (welcome) navigate(pathname, { replace: true, state: null });
    // Only on arrival: the mark is read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const landing = pathname === "/";
  const scrolled = useScrolled();
  const frameClass = landing ? `${styles.frame} ${styles.landing} darkScope` : styles.frame;
  // In the replay the bar stays in the flow, so the replay bar under it is not covered.
  const overlay = landing && mode !== "replay";
  const barClasses = [styles.bar, overlay && styles.overlay, overlay && (scrolled || menuOpen) && styles.barSolid];
  const barClass = barClasses.filter(Boolean).join(" ");

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
              <li>
                {status === "authenticated" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      void logout().then(() => navigate("/"));
                    }}
                  >
                    {t("nav.logout")}
                  </button>
                ) : (
                  <NavLink
                    to="/login"
                    className={({ isActive }) => (isActive ? styles.active : undefined)}
                    onClick={() => setMenuOpen(false)}
                  >
                    {t("nav.login")}
                  </NavLink>
                )}
              </li>
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
            <LanguageSwitch />
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

        {welcome && (
          <Notice className={styles.welcome}>
            <span>{t("auth.welcome")}</span>
            <button type="button" aria-label={t("auth.welcomeClose")} onClick={() => setWelcome(false)}>
              <Icon name="close" size={16} />
            </button>
          </Notice>
        )}

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

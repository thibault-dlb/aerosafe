import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import ReplayBar from "@/components/replay/ReplayBar";
import Icon from "@/components/ui/Icon";
import Notice from "@/components/ui/Notice";
import { useActiveAlertCount } from "@/hooks/useActiveAlertCount";
import { useAuth } from "@/hooks/useAuth";
import { useDataMode } from "@/hooks/useDataMode";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTranslation } from "@/hooks/useTranslation";
import ReplayProvider from "@/providers/ReplayProvider";
import type { AlertService } from "@/services/AlertService";
import { AppNavigation } from "@/services/AppNavigation";
import { SidebarPreference } from "@/services/SidebarPreference";

import styles from "./AppShell.module.css";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

const SIDEBAR_ID = "app-sidebar";
/** At this width and below, the side bar is a drawer opened from the top bar. */
const PHONE = "(max-width: 720px)";

export interface AppShellProps {
  /** Where the fold of the side bar is remembered. Tests give their own. */
  preferences?: SidebarPreference;
  /** Where the alert count of the menu comes from. Tests give their own. */
  alerts?: AlertService;
}

/**
 * The frame of every page of the application once logged in: the side bar with the pages the
 * role gives access to and the account, the thin top bar, the page, and the educational notice.
 * On a phone the side bar becomes a drawer.
 */
export default function AppShell({ preferences, alerts }: AppShellProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { mode } = useDataMode();
  const navigate = useNavigate();
  const { pathname, state } = useLocation();
  const phone = useMediaQuery(PHONE);
  const [saved] = useState(() => preferences ?? new SidebarPreference());
  const [folded, setFolded] = useState(() => saved.isFolded());
  const [drawerOpen, setDrawerOpen] = useState(false);
  // A new account is welcomed once, on the first page it opens: the mark is removed from the history.
  const [welcome, setWelcome] = useState(() => (state as { welcome?: boolean } | null)?.welcome === true);
  const alertCount = useActiveAlertCount(user?.isSupervisor === true, alerts);

  useEffect(() => {
    if (welcome) navigate(pathname, { replace: true, state: null });
    // Only on arrival: the mark is read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Following a link, or leaving the phone layout, closes the drawer.
  useEffect(() => setDrawerOpen(false), [pathname, phone]);

  useEffect(() => {
    if (!drawerOpen) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [drawerOpen]);

  if (!user) return null;

  const railed = folded && !phone;
  const title = AppNavigation.sectionOf(pathname)?.label ?? "nav.dashboard";

  function toggleFold() {
    saved.setFolded(!folded);
    setFolded(!folded);
  }

  return (
    <ReplayProvider>
      <div className={styles.shell}>
        <a className={styles.skip} href="#content">
          {t("layout.skipToContent")}
        </a>
        <Sidebar
          id={SIDEBAR_ID}
          user={user}
          railed={railed}
          drawerOpen={drawerOpen}
          hidden={phone && !drawerOpen}
          foldable={!phone}
          alertCount={alertCount}
          onNavigate={() => setDrawerOpen(false)}
          onToggleFold={toggleFold}
          onLogout={() => void logout().then(() => navigate("/"))}
        />
        {phone && drawerOpen && <div className={styles.backdrop} onClick={() => setDrawerOpen(false)} aria-hidden="true" />}

        <div className={styles.main}>
          <TopBar
            title={title}
            menuControls={SIDEBAR_ID}
            menuOpen={drawerOpen}
            onMenu={() => setDrawerOpen((open) => !open)}
          />
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
      </div>
    </ReplayProvider>
  );
}

import { Link, useLocation } from "react-router-dom";

import logoUrl from "@/assets/logo/aerosafe-logo.svg";
import Icon from "@/components/ui/Icon";
import { useTranslation } from "@/hooks/useTranslation";
import type { User } from "@/models/User";
import { AppNavigation, type NavItem } from "@/services/AppNavigation";

import AccountCard from "./AccountCard";
import styles from "./Sidebar.module.css";

export interface SidebarProps {
  id: string;
  user: User;
  /** Folded into a rail of icons. */
  railed: boolean;
  /** A phone shows the bar as a drawer: this is whether it is open. */
  drawerOpen: boolean;
  /** Out of the window and out of reach of the keyboard (the closed drawer of a phone). */
  hidden: boolean;
  /** Whether the visitor can fold it: not on a phone, where it is a drawer. */
  foldable: boolean;
  /** Active alerts, for the badge of the alerts entry. Null when there is nothing to show. */
  alertCount: number | null;
  onNavigate: () => void;
  onToggleFold: () => void;
  onLogout: () => void;
}

/** The menu of the application: the pages the role gives access to, then the account and the way out. */
export default function Sidebar({
  id,
  user,
  railed,
  drawerOpen,
  hidden,
  foldable,
  alertCount,
  onNavigate,
  onToggleFold,
  onLogout,
}: SidebarProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const current = AppNavigation.sectionOf(pathname)?.to;
  const supervision = AppNavigation.supervision(user);

  function entry(item: NavItem) {
    const label = t(item.label);
    const active = current === item.to;
    const showCount = item.to === "/alerts" && alertCount !== null && alertCount > 0;
    return (
      <li key={item.to}>
        <Link
          to={item.to}
          className={[styles.link, active && styles.active].filter(Boolean).join(" ")}
          aria-current={active ? "page" : undefined}
          title={railed ? label : undefined}
          onClick={onNavigate}
        >
          <Icon name={item.icon} />
          <span className={styles.label}>{label}</span>
          {showCount && (
            <span className={styles.count}>
              <span aria-hidden="true">{alertCount}</span>
              <span className="visually-hidden">{t("nav.activeCount", { count: alertCount })}</span>
            </span>
          )}
        </Link>
      </li>
    );
  }

  return (
    <aside
      id={id}
      className={[styles.side, railed && styles.railed].filter(Boolean).join(" ")}
      data-open={drawerOpen}
      inert={hidden}
      aria-hidden={hidden || undefined}
    >
      <Link to="/dashboard" className={styles.brand} onClick={onNavigate}>
        <img src={logoUrl} alt="" width={32} height={32} />
        <span className={styles.name}>AeroSafe</span>
      </Link>

      <nav aria-label={t("nav.main")} className={styles.nav}>
        <ul>{AppNavigation.common().map(entry)}</ul>
        {supervision.length > 0 && (
          <>
            <p className={styles.group} id={`${id}-supervision`}>
              {t("nav.supervision")}
            </p>
            <ul aria-labelledby={`${id}-supervision`}>{supervision.map(entry)}</ul>
          </>
        )}
      </nav>

      <div className={styles.foot}>
        <AccountCard user={user} compact={railed} />
        <button type="button" className={styles.link} onClick={onLogout}>
          <Icon name="logout" />
          <span className={styles.label}>{t("nav.logout")}</span>
        </button>
        {foldable && (
          <button
            type="button"
            className={styles.link}
            aria-expanded={!railed}
            aria-controls={id}
            onClick={onToggleFold}
          >
            <Icon name={railed ? "expand" : "collapse"} />
            <span className={styles.label}>{t(railed ? "nav.expand" : "nav.collapse")}</span>
          </button>
        )}
      </div>
    </aside>
  );
}

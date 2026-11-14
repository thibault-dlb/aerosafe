import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";

import logoUrl from "@/assets/logo/aerosafe-logo.svg";
import LanguageSwitch from "@/components/layout/LanguageSwitch";
import Icon from "@/components/ui/Icon";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useTranslation";
import { AuthRedirect } from "@/services/AuthRedirect";

import AuthForm from "./AuthForm";
import styles from "./AuthScreen.module.css";
import RadarScene from "./RadarScene";
import type { AuthMode } from "./TwoFaced";

/**
 * The log in and sign up screen, shared by `/login` and `/signup`. Three layers: the brown
 * ground, the radar on it with its edges melted into the ground, and the form above. Going
 * from one mode to the other swaps the two panels; the radar slides under the form and keeps
 * running, because this component and the radar stay mounted when the route changes.
 */
export default function AuthScreen() {
  const { t } = useTranslation();
  const { status } = useAuth();
  const { pathname, state } = useLocation();
  const [newAccount, setNewAccount] = useState(false);
  const mode: AuthMode = pathname === "/signup" ? "signup" : "login";

  // Whoever is logged in, whether just now or before, leaves this screen for the page asked for.
  if (status === "authenticated") {
    return <Navigate to={AuthRedirect.target(state)} replace state={newAccount ? { welcome: true } : undefined} />;
  }

  return (
    <div className={`${styles.screen} darkScope ${mode === "signup" ? styles.signup : ""}`}>
      <div className={styles.radarPane}>
        <div className={styles.radarMask}>
          <RadarScene />
        </div>
        <div className={styles.pitch}>
          <p className={styles.eyebrow}>{t("auth.radar.eyebrow")}</p>
          <h2>{t("auth.radar.title")}</h2>
          <p className={styles.text}>{t("auth.radar.text")}</p>
        </div>
      </div>

      <div className={styles.formPane}>
        <header className={styles.top}>
          <Link to="/" className={styles.brand} aria-label={t("auth.home")}>
            <img src={logoUrl} alt="" width={40} height={40} />
            <span>AeroSafe</span>
          </Link>
          <LanguageSwitch />
        </header>
        <main className={styles.main}>
          <AuthForm mode={mode} onNewAccount={setNewAccount} />
        </main>
        <p className={styles.edu} role="status">
          <Icon name="info" size={16} />
          <span>{t("layout.disclaimer")}</span>
        </p>
      </div>
    </div>
  );
}

import logoUrl from "@/assets/logo/aerosafe-logo.svg";
import PasswordForm from "@/components/account/PasswordForm";
import Icon from "@/components/ui/Icon";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useTranslation";

import styles from "./ChangePassword.module.css";

/**
 * Shown in place of every page while the password of the account is a provisional one, given by a
 * Supervisor: nothing else works until the owner chooses their own. Dark like the log in screen.
 */
export default function ChangePassword() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  return (
    <div className={styles.screen}>
      <main className={styles.card}>
        <img className={styles.logo} src={logoUrl} alt="" width={40} height={40} />
        <h1 className={styles.title}>{t("account.provisional.title")}</h1>
        <p className={styles.text}>{t("account.provisional.text")}</p>
        {user && <p className={styles.who}>{user.email}</p>}
        <PasswordForm submitLabel="account.provisional.submit" />
        <button type="button" className={styles.logout} onClick={() => void logout()}>
          <Icon name="logout" size={16} />
          {t("nav.logout")}
        </button>
      </main>
    </div>
  );
}

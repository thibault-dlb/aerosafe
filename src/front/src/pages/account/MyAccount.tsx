import { useState } from "react";

import DeleteAccountDialog from "@/components/account/DeleteAccountDialog";
import PasswordForm from "@/components/account/PasswordForm";
import LanguageSwitch from "@/components/layout/LanguageSwitch";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import Icon from "@/components/ui/Icon";
import Panel from "@/components/ui/Panel";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/hooks/usePreferences";
import { UNIT_SYSTEMS } from "@/services/UnitService";

import styles from "./MyAccount.module.css";

/**
 * The account of the visitor, for any role: who they are, a new password, the preferences kept in
 * this browser (language, units) and the deletion of the account.
 */
export default function MyAccount() {
  const { t, units, setUnits } = usePreferences();
  const { user } = useAuth();
  const [deleting, setDeleting] = useState(false);

  if (!user) return null;

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{t("account.title")}</h1>

      <Panel title={t("account.info.title")}>
        <div className={styles.identity}>
          <span className={styles.avatar} aria-hidden="true">
            {user.initials}
          </span>
          <dl className={styles.details}>
            <div>
              <dt>{t("account.info.email")}</dt>
              <dd className={styles.email}>{user.email}</dd>
            </div>
            <div>
              <dt>{t("account.info.role")}</dt>
              <dd>{t(user.isSupervisor ? "role.SUPERVISOR" : "role.USER")}</dd>
            </div>
          </dl>
        </div>
      </Panel>

      <Panel title={t("account.password.title")}>
        <PasswordForm submitLabel="account.password.submit" />
      </Panel>

      <Panel title={t("account.prefs.title")}>
        <p className={styles.hint}>{t("account.prefs.hint")}</p>
        <div className={styles.prefs}>
          <div className={styles.pref}>
            <span className={styles.label}>{t("language.label")}</span>
            <LanguageSwitch />
          </div>
          <div className={styles.pref} role="group" aria-label={t("account.prefs.units")}>
            <span className={styles.label} aria-hidden="true">
              {t("account.prefs.units")}
            </span>
            <div className={styles.choices}>
              {UNIT_SYSTEMS.map((choice) => (
                <Chip key={choice} pressed={units === choice} onClick={() => setUnits(choice)}>
                  {t(choice === "metric" ? "account.prefs.units.metric" : "account.prefs.units.aeronautical")}
                </Chip>
              ))}
            </div>
            <p className={styles.hint}>{t("account.prefs.units.hint")}</p>
          </div>
        </div>
      </Panel>

      <Panel title={t("account.delete.title")} className={styles.danger}>
        <p className={styles.hint}>{t("account.delete.text")}</p>
        <Button variant="danger" onClick={() => setDeleting(true)}>
          <Icon name="trash" size={16} />
          {t("account.delete.button")}
        </Button>
      </Panel>

      <DeleteAccountDialog open={deleting} onClose={() => setDeleting(false)} />
    </main>
  );
}

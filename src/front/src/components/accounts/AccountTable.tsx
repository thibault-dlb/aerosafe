import Pill from "@/components/ui/Pill";
import Switch from "@/components/ui/Switch";
import Table from "@/components/ui/Table";
import Icon from "@/components/ui/Icon";
import { usePreferences } from "@/hooks/usePreferences";
import type { Account } from "@/models/Account";
import type { RoleCode } from "@/models/User";
import { Formatter } from "@/services/Formatter";

import styles from "./AccountTable.module.css";

const ROLES: readonly RoleCode[] = ["USER", "SUPERVISOR"];

export interface AccountTableProps {
  accounts: Account[];
  /** The account of the Supervisor looking at the list: it cannot be changed from here. */
  currentId: string | null;
  /** The account being changed, whose controls wait for the answer. */
  busyId: string | null;
  onRole: (account: Account, role: RoleCode) => void;
  onActive: (account: Account, active: boolean) => void;
  onAnonymise: (account: Account) => void;
}

function Status({ account }: { account: Account }) {
  const { t } = usePreferences();
  if (account.isAnonymised) return <Pill tone="neutral">{t("accounts.status.anonymised")}</Pill>;
  if (!account.isActive) return <Pill tone="open">{t("accounts.status.inactive")}</Pill>;
  return (
    <>
      <Pill tone="air">{t("accounts.status.active")}</Pill>
      {account.mustChangePassword && <span className={styles.provisional}>{t("accounts.status.provisional")}</span>}
    </>
  );
}

/**
 * The accounts of the application. An anonymised account stays in the list, greyed, with nothing
 * to do; the account of the Supervisor who looks has no control either, so nobody locks
 * themselves out of the application from here.
 */
export default function AccountTable({ accounts, currentId, busyId, onRole, onActive, onAnonymise }: AccountTableProps) {
  const { t } = usePreferences();

  return (
    <Table>
      <caption className="visually-hidden">{t("accounts.table.caption")}</caption>
      <thead>
        <tr>
          <th scope="col">{t("accounts.col.account")}</th>
          <th scope="col">{t("accounts.col.role")}</th>
          <th scope="col">{t("accounts.col.status")}</th>
          <th scope="col">{t("accounts.col.created")}</th>
          <th scope="col">{t("accounts.col.actions")}</th>
        </tr>
      </thead>
      <tbody>
        {accounts.map((account) => {
          const own = account.id === currentId;
          const locked = own || account.isAnonymised;
          const busy = busyId === account.id;
          return (
            <tr key={account.id} className={account.isAnonymised ? styles.gone : undefined}>
              <td>
                <span className={styles.who}>
                  <span className={styles.avatar} aria-hidden="true">
                    {account.isAnonymised ? <Icon name="anonymous" size={16} /> : account.initials}
                  </span>
                  <span className={styles.email} title={account.isAnonymised ? account.email : undefined}>
                    {account.isAnonymised ? t("accounts.anonymisedName") : account.email}
                  </span>
                  {own && <span className={styles.you}>{t("accounts.you")}</span>}
                </span>
              </td>
              <td>
                <select
                  className={styles.role}
                  aria-label={t("accounts.roleFor", { email: account.email })}
                  value={account.role}
                  disabled={locked || busy}
                  onChange={(event) => onRole(account, event.target.value as RoleCode)}
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {t(role === "SUPERVISOR" ? "role.SUPERVISOR" : "role.USER")}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <Status account={account} />
              </td>
              <td className={styles.date}>{Formatter.date(account.createdAt)}</td>
              <td>
                {!account.isAnonymised && (
                  <span className={styles.actions}>
                    <Switch
                      checked={account.isActive}
                      disabled={locked || busy}
                      aria-label={t("accounts.activeFor", { email: account.email })}
                      onChange={(active) => onActive(account, active)}
                    >
                      {t("accounts.status.active")}
                    </Switch>
                    <button
                      type="button"
                      className={styles.anonymise}
                      aria-label={t("accounts.anonymiseFor", { email: account.email })}
                      disabled={locked || busy}
                      onClick={() => onAnonymise(account)}
                    >
                      <Icon name="anonymous" size={16} />
                      {t("accounts.anonymise")}
                    </button>
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

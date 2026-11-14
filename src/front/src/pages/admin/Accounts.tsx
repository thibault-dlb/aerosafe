import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import AccountTable from "@/components/accounts/AccountTable";
import AnonymiseDialog from "@/components/accounts/AnonymiseDialog";
import CreateAccountDialog from "@/components/accounts/CreateAccountDialog";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Field from "@/components/ui/Field";
import Icon from "@/components/ui/Icon";
import Notice from "@/components/ui/Notice";
import Pagination from "@/components/ui/Pagination";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/hooks/usePreferences";
import { useToast } from "@/hooks/useToast";
import type { TranslationKey } from "@/i18n/fr";
import { type Account, type AccountChanges, AccountPage } from "@/models/Account";
import type { RoleCode } from "@/models/User";
import { ErrorMessages } from "@/services/ErrorMessages";
import { UserService } from "@/services/UserService";

import styles from "./Accounts.module.css";

export const PAGE_SIZE = 20;

export interface AccountsProps {
  service?: UserService;
}

/**
 * UC-11 to UC-13: a Supervisor lists the accounts, creates one, changes a role, deactivates or
 * reactivates it and anonymises it. Nobody changes their own account from here.
 */
export default function Accounts({ service }: AccountsProps) {
  const { t } = usePreferences();
  const { user } = useAuth();
  const toast = useToast();
  const api = useMemo(() => service ?? new UserService(), [service]);
  const [page, setPage] = useState<AccountPage | null>(null);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [reload, setReload] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toAnonymise, setToAnonymise] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    api
      .list({ search: search || undefined, limit: PAGE_SIZE, offset })
      .then((loaded) => {
        if (!cancelled) setPage(loaded);
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(ErrorMessages.ACCOUNTS.key(failure));
      });
    return () => {
      cancelled = true;
    };
  }, [api, search, offset, reload]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    setOffset(0);
    setSearch(draft.trim());
  }

  const replace = useCallback((updated: Account) => {
    setPage((current) =>
      current
        ? new AccountPage(
            current.items.map((item) => (item.id === updated.id ? updated : item)),
            current.total,
          )
        : current,
    );
  }, []);

  async function change(account: Account, changes: AccountChanges, done: (updated: Account) => string) {
    setBusyId(account.id);
    try {
      const updated = await api.update(account.id, changes);
      replace(updated);
      toast.notify({ message: done(updated) });
    } catch (failure) {
      toast.notify({ message: t(ErrorMessages.ACCOUNTS.key(failure)), tone: "error" });
    } finally {
      setBusyId(null);
    }
  }

  const onRole = (account: Account, role: RoleCode) =>
    change(account, { role }, (updated) =>
      t("accounts.toast.role", { email: updated.email, role: t(role === "SUPERVISOR" ? "role.SUPERVISOR" : "role.USER") }),
    );

  const onActive = (account: Account, active: boolean) =>
    change(account, { is_active: active }, (updated) =>
      t(active ? "accounts.toast.active" : "accounts.toast.inactive", { email: updated.email }),
    );

  async function onAnonymise(account: Account) {
    setBusyId(account.id);
    try {
      replace(await api.anonymise(account.id));
      toast.notify({ message: t("accounts.toast.anonymised") });
    } catch (failure) {
      toast.notify({ message: t(ErrorMessages.ACCOUNTS.key(failure)), tone: "error" });
    } finally {
      setBusyId(null);
      setToAnonymise(null);
    }
  }

  function onCreated(created: boolean) {
    setCreating(false);
    if (created) {
      toast.notify({ message: t("accounts.toast.created") });
      setSearch("");
      setDraft("");
      setOffset(0);
      setReload((count) => count + 1);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{t("accounts.title")}</h1>
        <Button onClick={() => setCreating(true)}>
          <Icon name="plus" size={16} />
          {t("accounts.create")}
        </Button>
      </header>
      <Notice>{t("accounts.intro")}</Notice>

      <form className={styles.search} role="search" onSubmit={onSearch}>
        <Field
          label={t("accounts.search.label")}
          type="search"
          icon="search"
          placeholder={t("accounts.search.placeholder")}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" variant="secondary">
          {t("accounts.search.go")}
        </Button>
      </form>

      {error && <Notice variant="danger">{t(error)}</Notice>}
      {page === null && !error && <p role="status">{t("accounts.loading")}</p>}
      {page !== null && page.items.length === 0 && (
        <EmptyState kind="results" title={t("accounts.empty.title")}>
          {t("accounts.empty.text")}
        </EmptyState>
      )}
      {page !== null && page.items.length > 0 && (
        <>
          <AccountTable
            accounts={page.items}
            currentId={user?.id ?? null}
            busyId={busyId}
            onRole={(account, role) => void onRole(account, role)}
            onActive={(account, active) => void onActive(account, active)}
            onAnonymise={setToAnonymise}
          />
          <Pagination offset={offset} pageSize={PAGE_SIZE} total={page.total} onChange={setOffset} />
        </>
      )}

      <AnonymiseDialog
        account={toAnonymise}
        busy={busyId !== null}
        onConfirm={(account) => void onAnonymise(account)}
        onClose={() => setToAnonymise(null)}
      />
      <CreateAccountDialog open={creating} service={api} onClose={onCreated} />
    </main>
  );
}

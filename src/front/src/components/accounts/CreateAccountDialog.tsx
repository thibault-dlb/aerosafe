import { type FormEvent, useState } from "react";

import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import Field from "@/components/ui/Field";
import Icon from "@/components/ui/Icon";
import Notice from "@/components/ui/Notice";
import { usePreferences } from "@/hooks/usePreferences";
import type { TranslationKey } from "@/i18n/fr";
import type { CreatedAccount } from "@/models/Account";
import type { RoleCode } from "@/models/User";
import { ErrorMessages } from "@/services/ErrorMessages";
import type { UserService } from "@/services/UserService";

import styles from "./Dialogs.module.css";

/** A simple shape check, like the API's: there is no e-mail verification. */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface CreateAccountDialogProps {
  open: boolean;
  service: UserService;
  /** The dialog was closed. `created` is true when an account was made, so the list must reload. */
  onClose: (created: boolean) => void;
}

/**
 * Creates an account in two steps: the e-mail address and the role, then the provisional password
 * the API generated. That password is shown once, with a button to copy it: it is not kept.
 */
export default function CreateAccountDialog({ open, service, onClose }: CreateAccountDialogProps) {
  const { t } = usePreferences();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleCode>("USER");
  const [emailError, setEmailError] = useState<TranslationKey | null>(null);
  const [failure, setFailure] = useState<TranslationKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedAccount | null>(null);
  const [copied, setCopied] = useState(false);

  function finish() {
    const made = created !== null;
    setEmail("");
    setRole("USER");
    setEmailError(null);
    setFailure(null);
    setCreated(null);
    setCopied(false);
    onClose(made);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    if (!EMAIL.test(email.trim())) {
      setEmailError("auth.email.invalid");
      return;
    }
    setEmailError(null);
    setSaving(true);
    try {
      setCreated(await service.create(email.trim(), role));
    } catch (error) {
      setFailure(ErrorMessages.NEW_ACCOUNT.key(error));
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.temporaryPassword);
      setCopied(true);
    } catch {
      // The clipboard can be refused: the password stays on screen to be copied by hand.
    }
  }

  if (created) {
    return (
      <Dialog
        open={open}
        title={t("accounts.created.title")}
        icon="key"
        onClose={finish}
        actions={<Button onClick={finish}>{t("accounts.created.done")}</Button>}
      >
        <p className={styles.text}>{t("accounts.created.text", { email: created.account.email })}</p>
        <div className={styles.secret}>
          <span className={styles.secretLabel}>{t("accounts.created.password")}</span>
          <code className={styles.password}>{created.temporaryPassword}</code>
          <Button variant="secondary" onClick={() => void copy()}>
            <Icon name={copied ? "check" : "copy"} size={16} />
            {t(copied ? "accounts.created.copied" : "accounts.created.copy")}
          </Button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      title={t("accounts.create.title")}
      icon="plus"
      onClose={finish}
      actions={
        <>
          <Button variant="secondary" onClick={finish}>
            {t("dialog.cancel")}
          </Button>
          <Button type="submit" form="create-account" disabled={saving} aria-busy={saving}>
            {t(saving ? "accounts.create.submitting" : "accounts.create.submit")}
          </Button>
        </>
      }
    >
      <form id="create-account" className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
        <p className={styles.text}>{t("accounts.create.intro")}</p>
        {failure && <Notice variant="danger">{t(failure)}</Notice>}
        <Field
          label={t("accounts.create.email")}
          type="email"
          autoComplete="off"
          value={email}
          error={emailError ? t(emailError) : undefined}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label className={styles.select}>
          <span>{t("accounts.create.role")}</span>
          <select value={role} onChange={(event) => setRole(event.target.value as RoleCode)}>
            <option value="USER">{t("role.USER")}</option>
            <option value="SUPERVISOR">{t("role.SUPERVISOR")}</option>
          </select>
        </label>
      </form>
    </Dialog>
  );
}

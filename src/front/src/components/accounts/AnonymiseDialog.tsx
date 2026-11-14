import { useState } from "react";

import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import Field from "@/components/ui/Field";
import { usePreferences } from "@/hooks/usePreferences";
import type { Account } from "@/models/Account";

import styles from "./Dialogs.module.css";

export interface AnonymiseDialogProps {
  /** The account to anonymise; the dialog is closed while it is null. */
  account: Account | null;
  busy: boolean;
  onConfirm: (account: Account) => void;
  onClose: () => void;
}

/**
 * Asks for a second step before an anonymisation, which cannot be undone: the word must be typed
 * for the button to work, so a stray click anywhere cannot erase an account.
 */
export default function AnonymiseDialog({ account, busy, onConfirm, onClose }: AnonymiseDialogProps) {
  const { t } = usePreferences();
  const [typed, setTyped] = useState("");
  const word = t("accounts.anonymise.word");
  const confirmed = typed.trim().toLowerCase() === word.toLowerCase();

  function close() {
    setTyped("");
    onClose();
  }

  return (
    <Dialog
      open={account !== null}
      title={t("accounts.anonymise.title")}
      tone="danger"
      icon="anonymous"
      onClose={close}
      actions={
        <>
          <Button variant="secondary" onClick={close}>
            {t("dialog.cancel")}
          </Button>
          <Button
            variant="danger"
            disabled={!confirmed || busy}
            onClick={() => {
              if (account) onConfirm(account);
              setTyped("");
            }}
          >
            {t("accounts.anonymise.submit")}
          </Button>
        </>
      }
    >
      <p className={styles.text}>{t("accounts.anonymise.text", { email: account?.email ?? "" })}</p>
      <Field
        label={t("accounts.anonymise.confirm", { word })}
        value={typed}
        autoComplete="off"
        onChange={(event) => setTyped(event.target.value)}
      />
    </Dialog>
  );
}

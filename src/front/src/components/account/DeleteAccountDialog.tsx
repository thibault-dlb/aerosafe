import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import PasswordField from "@/components/auth/PasswordField";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import Notice from "@/components/ui/Notice";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/fr";
import { ErrorMessages } from "@/services/ErrorMessages";

import styles from "./DeleteAccountDialog.module.css";

export interface DeleteAccountDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Deletes the account of the visitor, which means anonymising it: it asks for the password again
 * and, once the API has done it, leaves for the home page, since the session is closed.
 */
export default function DeleteAccountDialog({ open, onClose }: DeleteAccountDialogProps) {
  const { t } = useTranslation();
  const { deleteAccount } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [failure, setFailure] = useState<TranslationKey | null>(null);
  const [deleting, setDeleting] = useState(false);

  function close() {
    setPassword("");
    setFailure(null);
    onClose();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password === "") {
      setFailure("account.password.currentRequired");
      return;
    }
    setFailure(null);
    setDeleting(true);
    try {
      await deleteAccount(password);
      toast.notify({ message: t("account.delete.toast") });
      navigate("/", { replace: true });
    } catch (error) {
      setFailure(ErrorMessages.DELETION.key(error));
      setDeleting(false);
    }
  }

  return (
    <Dialog
      open={open}
      title={t("account.delete.dialog")}
      tone="danger"
      icon="trash"
      onClose={close}
      actions={
        <>
          <Button variant="secondary" onClick={close}>
            {t("dialog.cancel")}
          </Button>
          <Button type="submit" form="delete-account" variant="danger" disabled={deleting} aria-busy={deleting}>
            {t(deleting ? "account.delete.deleting" : "account.delete.confirm")}
          </Button>
        </>
      }
    >
      <form id="delete-account" className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
        <p className={styles.text}>{t("account.delete.text")}</p>
        {failure && <Notice variant="danger">{t(failure)}</Notice>}
        <PasswordField
          label={t("account.delete.password")}
          name="delete-password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </form>
    </Dialog>
  );
}

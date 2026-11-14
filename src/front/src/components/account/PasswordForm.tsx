import { type FormEvent, useState } from "react";

import PasswordField from "@/components/auth/PasswordField";
import Button from "@/components/ui/Button";
import Notice from "@/components/ui/Notice";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/fr";
import { ErrorMessages } from "@/services/ErrorMessages";
import { PasswordRules } from "@/services/PasswordRules";

import styles from "./PasswordForm.module.css";

export interface PasswordFormProps {
  /** The text of the button. */
  submitLabel: TranslationKey;
}

interface FieldErrors {
  current?: TranslationKey;
  next?: TranslationKey;
}

/**
 * Replaces the password: the current one is asked again, then the new one with its length
 * gauge. Used on the account page and on the screen that makes a provisional password go.
 */
export default function PasswordForm({ submitLabel }: PasswordFormProps) {
  const { t } = useTranslation();
  const { changePassword } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<TranslationKey | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: FieldErrors = {};
    if (current === "") found.current = "account.password.currentRequired";
    if (!PasswordRules.isLongEnough(next)) found.next = "auth.password.minimum";
    setErrors(found);
    setFailure(null);
    if (found.current || found.next) return;

    setSaving(true);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      toast.notify({ message: t("account.password.toast") });
    } catch (error) {
      setFailure(ErrorMessages.PASSWORD.key(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
      {failure && <Notice variant="danger">{t(failure)}</Notice>}
      <PasswordField
        label={t("account.password.current")}
        name="current-password"
        autoComplete="current-password"
        value={current}
        error={errors.current ? t(errors.current) : undefined}
        onChange={(event) => setCurrent(event.target.value)}
      />
      <PasswordField
        label={t("account.password.new")}
        name="new-password"
        autoComplete="new-password"
        gauge
        value={next}
        error={errors.next ? t(errors.next) : undefined}
        onChange={(event) => setNext(event.target.value)}
      />
      <Button type="submit" disabled={saving} aria-busy={saving}>
        {t(saving ? "account.password.saving" : submitLabel)}
      </Button>
    </form>
  );
}

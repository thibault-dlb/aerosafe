import { type FormEvent, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import Fold from "@/components/ui/Fold";
import Icon from "@/components/ui/Icon";
import Notice from "@/components/ui/Notice";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/fr";
import { AuthMessages } from "@/services/AuthMessages";
import { PasswordRules } from "@/services/PasswordRules";

import styles from "./AuthForm.module.css";
import PasswordField from "./PasswordField";
import TwoFaced, { type AuthMode } from "./TwoFaced";

/** A simple shape check, like the API's: there is no e-mail verification. */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface AuthFormProps {
  mode: AuthMode;
  /** Told before a sign up starts and if it fails, so the page knows a new account is being made. */
  onNewAccount?: (starting: boolean) => void;
}

/** What went wrong, and in which mode: a message does not follow the visitor into the other mode. */
interface Failure {
  mode: AuthMode;
  key: TranslationKey;
}

interface FieldErrors {
  mode: AuthMode;
  email?: TranslationKey;
  password?: TranslationKey;
}

/**
 * The log in and sign up form. It is one form for both: when the mode changes the title, the
 * length gauge and the button turn, and what was typed stays.
 */
export default function AuthForm({ mode, onNewAccount }: AuthFormProps) {
  const { t } = useTranslation();
  const { login, signUp } = useAuth();
  const { state } = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [invalid, setInvalid] = useState<FieldErrors | null>(null);
  const lastFailure = useRef<TranslationKey>("auth.error.network");

  const signup = mode === "signup";
  const shownFailure = failure?.mode === mode ? failure.key : null;
  if (shownFailure) lastFailure.current = shownFailure;
  const fieldErrors = invalid?.mode === mode ? invalid : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const errors: FieldErrors = { mode };
    if (!EMAIL.test(email.trim())) {
      errors.email = "auth.email.invalid";
    }
    if (password === "") {
      errors.password = "auth.password.required";
    } else if (signup && !PasswordRules.isLongEnough(password)) {
      errors.password = "auth.password.minimum";
    }
    setInvalid(errors);
    setFailure(null);
    if (errors.email || errors.password) return;

    setSubmitting(true);
    try {
      if (signup) {
        onNewAccount?.(true);
        await signUp(email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
    } catch (error) {
      onNewAccount?.(false);
      setFailure({ mode, key: AuthMessages.key(error) });
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} data-mode={mode} onSubmit={(event) => void submit(event)} noValidate>
      <nav className={styles.tabs} aria-label={t("auth.tabs")}>
        <Link to="/login" state={state} aria-current={signup ? undefined : "page"}>
          {t("auth.tab.login")}
        </Link>
        <Link to="/signup" state={state} aria-current={signup ? "page" : undefined}>
          {t("auth.tab.signup")}
        </Link>
      </nav>

      <h1 className={styles.title}>
        <TwoFaced mode={mode} login={t("auth.login.title")} signup={t("auth.signup.title")} />
      </h1>
      <p className={styles.subtitle}>
        <TwoFaced mode={mode} login={t("auth.login.subtitle")} signup={t("auth.signup.subtitle")} />
      </p>

      <div className={styles.fields}>
        <Fold open={shownFailure !== null}>
          <Notice variant="danger" className={styles.failure}>
            <Icon name="alert" size={18} />
            <span>{t(lastFailure.current)}</span>
          </Notice>
        </Fold>
        <Field
          label={t("auth.email.label")}
          icon="mail"
          type="email"
          name="email"
          autoComplete="email"
          placeholder={t("auth.email.placeholder")}
          value={email}
          error={fieldErrors?.email ? t(fieldErrors.email) : undefined}
          onChange={(event) => setEmail(event.target.value)}
        />
        <PasswordField
          label={t("auth.password.label")}
          name="password"
          autoComplete={signup ? "new-password" : "current-password"}
          value={password}
          gauge={signup}
          error={fieldErrors?.password ? t(fieldErrors.password) : undefined}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      <Button type="submit" className={styles.submit} disabled={submitting} aria-busy={submitting}>
        <TwoFaced mode={mode} login={t("auth.login.submit")} signup={t("auth.signup.submit")} />
      </Button>

      <p className={styles.switch}>
        <TwoFaced
          mode={mode}
          login={
            <>
              {t("auth.login.switch")} <Link to="/signup" state={state}>{t("auth.login.switchLink")}</Link>
            </>
          }
          signup={
            <>
              {t("auth.signup.switch")} <Link to="/login" state={state}>{t("auth.signup.switchLink")}</Link>
            </>
          }
        />
      </p>
    </form>
  );
}

import { type KeyboardEvent, useState } from "react";

import Field, { type FieldProps } from "@/components/ui/Field";
import Fold from "@/components/ui/Fold";
import Icon from "@/components/ui/Icon";
import { useTranslation } from "@/hooks/useTranslation";
import { PasswordRules } from "@/services/PasswordRules";

import LengthGauge from "./LengthGauge";
import styles from "./PasswordField.module.css";

export interface PasswordFieldProps extends Omit<FieldProps, "type" | "icon" | "trailing" | "value"> {
  value: string;
  /** Shows the length gauge: when choosing a password, not when typing one. */
  gauge?: boolean;
}

/**
 * A password field: it can show what is typed, warns when Caps Lock is on, and, to choose a
 * password, shows how far the typed one is from the required length.
 */
export default function PasswordField({ value, gauge = false, onKeyDown, onKeyUp, onBlur, ...rest }: PasswordFieldProps) {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  function watchCapsLock(event: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(event.getModifierState("CapsLock"));
  }

  const reveal = (
    <button
      type="button"
      className={styles.reveal}
      aria-label={t(shown ? "auth.password.hide" : "auth.password.show")}
      aria-pressed={shown}
      onClick={() => setShown((current) => !current)}
    >
      <Icon name={shown ? "eyeOff" : "eye"} size={20} />
    </button>
  );

  return (
    <div>
      <Field
        {...rest}
        value={value}
        type={shown ? "text" : "password"}
        icon="lock"
        trailing={reveal}
        maxLength={PasswordRules.MAX_LENGTH}
        onKeyDown={(event) => {
          watchCapsLock(event);
          onKeyDown?.(event);
        }}
        onKeyUp={(event) => {
          watchCapsLock(event);
          onKeyUp?.(event);
        }}
        onBlur={(event) => {
          setCapsLock(false);
          onBlur?.(event);
        }}
      />
      <Fold open={capsLock}>
        <p className={styles.caps}>
          <Icon name="capsLock" size={14} />
          {t("auth.password.caps")}
        </p>
      </Fold>
      <Fold open={gauge}>
        <LengthGauge length={value.length} />
      </Fold>
    </div>
  );
}

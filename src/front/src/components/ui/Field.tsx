import type { InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";

import styles from "./Field.module.css";
import Icon from "./Icon";
import type { IconName } from "./IconSet";

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  hint?: string;
  /** When set, the field is marked invalid and the message is read with the field. */
  error?: string;
  /** An icon at the start of the input. */
  icon?: IconName;
  /** A control at the end of the input, such as the button that reveals a password. */
  trailing?: ReactNode;
}

/** A labelled text field. The label, the hint and the error are tied to the input. */
export default function Field({ label, hint, error, icon, trailing, className, ...rest }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;
  const inputClasses = [styles.input, icon && styles.withIcon, trailing && styles.withTrailing, className];
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.control}>
        {icon && <Icon name={icon} className={styles.icon} />}
        <input
          id={id}
          className={inputClasses.filter(Boolean).join(" ")}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        {trailing && <div className={styles.trailing}>{trailing}</div>}
      </div>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}

import Icon from "@/components/ui/Icon";
import { useTranslation } from "@/hooks/useTranslation";
import { PasswordRules } from "@/services/PasswordRules";

import styles from "./LengthGauge.module.css";

export interface LengthGaugeProps {
  /** Number of characters typed. */
  length: number;
}

/**
 * Fills up to the 12 characters the API asks for. It shows the only rule there is, a length,
 * and not a made up strength.
 */
export default function LengthGauge({ length }: LengthGaugeProps) {
  const { t } = useTranslation();
  const filled = Math.min(length, PasswordRules.MIN_LENGTH);
  const enough = length >= PasswordRules.MIN_LENGTH;

  return (
    <div className={[styles.gauge, enough && styles.enough].filter(Boolean).join(" ")}>
      <div
        className={styles.track}
        role="meter"
        aria-label={t("auth.password.gauge")}
        aria-valuemin={0}
        aria-valuemax={PasswordRules.MIN_LENGTH}
        aria-valuenow={filled}
      >
        {Array.from({ length: PasswordRules.MIN_LENGTH }, (_, index) => (
          <i key={index} className={index < filled ? styles.on : undefined} />
        ))}
      </div>
      <div className={styles.legend}>
        <span aria-live="polite">
          {enough && <Icon name="check" size={14} />}
          {t(enough ? "auth.password.enough" : "auth.password.minimum")}
        </span>
        <span className="mono">
          {length} / {PasswordRules.MIN_LENGTH}
        </span>
      </div>
    </div>
  );
}

import { useTranslation } from "@/hooks/useTranslation";
import type { ToastInput } from "@/providers/ToastContext";

import Icon from "./Icon";
import styles from "./Toast.module.css";

export interface ToastProps extends Pick<ToastInput, "message" | "tone" | "action"> {
  onDismiss: () => void;
}

/** One floating notification. A success is a status; an error is an alert, read out at once. */
export default function Toast({ message, tone = "success", action, onDismiss }: ToastProps) {
  const { t } = useTranslation();
  return (
    <div className={`${styles.toast} ${styles[tone]}`} role={tone === "error" ? "alert" : "status"}>
      <Icon name={tone === "error" ? "alert" : "check"} size={20} className={styles.icon} />
      <p className={styles.message}>{message}</p>
      {action && (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            action.onAction();
            onDismiss();
          }}
        >
          {action.label}
        </button>
      )}
      <button type="button" className={styles.close} aria-label={t("toast.close")} onClick={onDismiss}>
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}

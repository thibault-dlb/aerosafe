import { useTranslation } from "@/hooks/useTranslation";
import type { User } from "@/models/User";

import styles from "./AccountCard.module.css";

export interface AccountCardProps {
  user: User;
  /** Only the avatar is shown: the side bar is folded into a rail. */
  compact?: boolean;
}

/** Who is logged in: an avatar with the initials, the e-mail address and the role, with a shape for it. */
export default function AccountCard({ user, compact = false }: AccountCardProps) {
  const { t } = useTranslation();
  return (
    <div className={[styles.account, compact && styles.compact].filter(Boolean).join(" ")} aria-label={t("nav.account")} role="group">
      <span className={styles.avatar} aria-hidden="true">
        {user.initials}
      </span>
      <span className={styles.who}>
        <b className={styles.email} title={user.email}>
          {user.email}
        </b>
        <span className={styles.role}>
          {/* A diamond for the Supervisor and a dot for the User: the role is not told by colour alone. */}
          <svg viewBox="0 0 10 10" aria-hidden="true">
            {user.isSupervisor ? <path d="M5 0l5 5-5 5-5-5z" /> : <circle cx="5" cy="5" r="4" />}
          </svg>
          {t(user.isSupervisor ? "role.SUPERVISOR" : "role.USER")}
        </span>
      </span>
    </div>
  );
}

import { ButtonLink } from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { useTranslation } from "@/hooks/useTranslation";

import styles from "./Forbidden.module.css";

/** A page the role of the visitor does not give access to. */
export default function Forbidden() {
  const { t } = useTranslation();
  return (
    <main className={styles.page}>
      <div className={styles.badge}>
        <Icon name="lock" size={32} />
      </div>
      <h1>{t("auth.forbidden.title")}</h1>
      <p>{t("auth.forbidden.text")}</p>
      <ButtonLink to="/dashboard" variant="secondary">
        <Icon name="dashboard" size={18} />
        {t("auth.forbidden.back")}
      </ButtonLink>
    </main>
  );
}

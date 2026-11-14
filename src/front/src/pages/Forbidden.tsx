import { ButtonLink } from "@/components/ui/Button";
import { useTranslation } from "@/hooks/useTranslation";

/** A page the role of the visitor does not give access to. */
export default function Forbidden() {
  const { t } = useTranslation();
  return (
    <main>
      <h1>{t("auth.forbidden.title")}</h1>
      <p>{t("auth.forbidden.text")}</p>
      <ButtonLink to="/dashboard" variant="secondary">
        {t("auth.forbidden.back")}
      </ButtonLink>
    </main>
  );
}

import { useTranslation } from "@/hooks/useTranslation";

/** Shown while the API says whether a session is kept for this browser. */
export default function SessionLoading() {
  const { t } = useTranslation();
  return (
    <main>
      <p role="status">{t("auth.loading")}</p>
    </main>
  );
}

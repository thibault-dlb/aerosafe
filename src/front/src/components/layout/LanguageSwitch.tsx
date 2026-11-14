import { useTranslation } from "@/hooks/useTranslation";
import { LANGUAGES } from "@/services/TranslationService";

import styles from "./LanguageSwitch.module.css";

/** The two buttons that switch the language of the interface. */
export default function LanguageSwitch() {
  const { t, language, setLanguage } = useTranslation();
  return (
    <div role="group" aria-label={t("language.label")} className={styles.group}>
      {LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-label={t(code === "fr" ? "language.fr" : "language.en")}
          aria-pressed={language === code}
          onClick={() => setLanguage(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

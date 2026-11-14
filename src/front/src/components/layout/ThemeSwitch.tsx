import Icon from "@/components/ui/Icon";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";

import styles from "./ThemeSwitch.module.css";

/** Switches between the dark and the light theme. */
export default function ThemeSwitch() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  return (
    <button
      type="button"
      className={styles.button}
      aria-label={t(theme === "dark" ? "theme.toLight" : "theme.toDark")}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
    </button>
  );
}

import Icon from "@/components/ui/Icon";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/fr";

import DataModeSwitch from "./DataModeSwitch";
import LanguageSwitch from "./LanguageSwitch";
import ThemeSwitch from "./ThemeSwitch";
import styles from "./TopBar.module.css";

export interface TopBarProps {
  /** Name of the page, from the menu entry it belongs to. */
  title: TranslationKey;
  /** The id of the side bar the menu button opens. */
  menuControls: string;
  menuOpen: boolean;
  onMenu: () => void;
}

/** The thin bar over the pages: where we are, the data source, the language and the theme. */
export default function TopBar({ title, menuControls, menuOpen, onMenu }: TopBarProps) {
  const { t } = useTranslation();
  return (
    <header className={styles.top}>
      <button
        type="button"
        className={styles.menu}
        aria-expanded={menuOpen}
        aria-controls={menuControls}
        aria-label={t(menuOpen ? "nav.closeMenu" : "nav.openMenu")}
        onClick={onMenu}
      >
        <Icon name={menuOpen ? "close" : "menu"} size={20} />
      </button>
      <p className={styles.title}>{t(title)}</p>
      <div className={styles.controls}>
        <DataModeSwitch />
        <LanguageSwitch />
        <ThemeSwitch />
      </div>
    </header>
  );
}

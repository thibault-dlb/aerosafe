import Icon from "@/components/ui/Icon";
import { useDataMode } from "@/hooks/useDataMode";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/fr";
import { DATA_MODES, type DataMode } from "@/services/DataModeService";

import styles from "./DataModeSwitch.module.css";

const LABELS: Record<DataMode, TranslationKey> = {
  opensky: "mode.opensky",
  adsbfi: "mode.adsbfi",
  replay: "mode.replay",
};

/** Chooses the data the pages show: one of the two live collections, or the replay of historical traffic. */
export default function DataModeSwitch() {
  const { t } = useTranslation();
  const { mode, setMode } = useDataMode();
  return (
    <div role="group" aria-label={t("mode.label")} className={styles.group}>
      {DATA_MODES.map((code) => {
        const label = t(LABELS[code]);
        return (
          <button key={code} type="button" aria-label={label} aria-pressed={mode === code} onClick={() => setMode(code)}>
            <Icon name={code === "replay" ? "replay" : "live"} size={16} />
            <span className={styles.text}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

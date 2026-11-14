import Icon from "@/components/ui/Icon";
import { useDataMode } from "@/hooks/useDataMode";
import { useTranslation } from "@/hooks/useTranslation";
import { DATA_MODES } from "@/services/DataModeService";

import styles from "./DataModeSwitch.module.css";

/** Chooses the data the pages show: the live collection, or the replay of historical traffic. */
export default function DataModeSwitch() {
  const { t } = useTranslation();
  const { mode, setMode } = useDataMode();
  return (
    <div role="group" aria-label={t("mode.label")} className={styles.group}>
      {DATA_MODES.map((code) => {
        const label = t(code === "live" ? "mode.live" : "mode.replay");
        return (
          <button key={code} type="button" aria-label={label} aria-pressed={mode === code} onClick={() => setMode(code)}>
            <Icon name={code === "live" ? "live" : "replay"} size={16} />
            <span className={styles.text}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

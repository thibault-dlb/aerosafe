import { type FormEvent, useState } from "react";

import Button from "@/components/ui/Button";
import CriticalityMark from "@/components/ui/CriticalityMark";
import Field from "@/components/ui/Field";
import RuleDiagram from "@/components/ui/RuleDiagram";
import RuleIcon from "@/components/ui/RuleIcon";
import Switch from "@/components/ui/Switch";
import { usePreferences } from "@/hooks/usePreferences";
import type { Criticality } from "@/models/Alert";
import type { Rule, RuleChanges } from "@/models/Rule";
import { Formatter } from "@/services/Formatter";
import { RuleLabels } from "@/services/RuleLabels";

import styles from "./RuleCard.module.css";

export interface RuleCardProps {
  rule: Rule;
  /** Saves the changed settings. The card stays as it is until the rule it shows is replaced. */
  onSave: (code: string, changes: RuleChanges) => Promise<void>;
}

const LEVELS: (Criticality | null)[] = [null, "LOW", "MEDIUM", "HIGH"];

/** One rule: what it detects, its threshold, the criticality of its alerts, and whether it runs. Only the changed settings are sent. */
export default function RuleCard({ rule, onSave }: RuleCardProps) {
  const { t } = usePreferences();
  const [threshold, setThreshold] = useState(String(rule.threshold));
  const [criticality, setCriticality] = useState<Criticality | null>(rule.criticality);
  const [active, setActive] = useState(rule.isActive);
  const [saving, setSaving] = useState(false);

  const value = Number(threshold);
  const valid = threshold.trim() !== "" && Number.isFinite(value) && value >= 0;
  const changes: RuleChanges = {};
  if (valid && value !== rule.threshold) changes.threshold = value;
  if (criticality !== rule.criticality) changes.criticality = criticality;
  if (active !== rule.isActive) changes.is_active = active;
  const changed = Object.keys(changes).length > 0;
  const name = RuleLabels.name(rule.code, rule.description, t);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!valid || !changed) return;
    setSaving(true);
    try {
      await onSave(rule.code, changes);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className={[styles.card, changed && styles.dirty, !active && styles.off].filter(Boolean).join(" ")}
      onSubmit={onSubmit}
      aria-label={`${rule.code} · ${name}`}
    >
      <div className={styles.headline}>
        <span className={styles.badge}>
          <RuleIcon code={rule.code} size={24} />
        </span>
        <div className={styles.names}>
          <h2 className={styles.name}>
            {rule.code} · {name}
          </h2>
          <p className={styles.muted}>{t(active ? "rules.evaluated" : "rules.notEvaluated")}</p>
        </div>
        <Switch checked={active} onChange={setActive} aria-label={t("rules.switchLabel", { code: rule.code })}>
          {t(active ? "rules.active" : "rules.inactive")}
        </Switch>
      </div>

      <div className={styles.middle}>
        <div className={styles.left}>
          <p className={styles.detects}>{RuleLabels.detects(rule.code, rule.description, t)}</p>
          <Field
            label={t("rules.threshold", { code: rule.code, unit: rule.unit })}
            type="number"
            min={0}
            step="any"
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
            error={valid ? undefined : t("rules.thresholdInvalid")}
            className="mono"
          />
        </div>
        <RuleDiagram code={rule.code} className={styles.diagram} />
      </div>

      <div className={styles.levels} role="group" aria-label={t("rules.criticality")}>
        <span className={styles.levelsLabel}>{t("rules.criticality")}</span>
        <div className={styles.segments}>
          {LEVELS.map((level) => (
            <button
              key={level ?? "none"}
              type="button"
              className={styles.segment}
              aria-pressed={criticality === level}
              onClick={() => setCriticality(level)}
            >
              <CriticalityMark level={level} variant="label" />
            </button>
          ))}
        </div>
      </div>

      <footer className={styles.footer}>
        <span className={styles.muted}>{t("rules.updated", { date: Formatter.date(rule.updatedAt) })}</span>
        {changed && (
          <Button type="submit" disabled={!valid || saving}>
            {t(saving ? "rules.saving" : "rules.save")}
          </Button>
        )}
      </footer>
    </form>
  );
}

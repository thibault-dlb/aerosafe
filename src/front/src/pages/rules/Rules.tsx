import { useEffect, useMemo, useState } from "react";

import RuleCard from "@/components/rules/RuleCard";
import EmptyState from "@/components/ui/EmptyState";
import Notice from "@/components/ui/Notice";
import { usePreferences } from "@/hooks/usePreferences";
import { useToast } from "@/hooks/useToast";
import type { TranslationKey } from "@/i18n/fr";
import type { Rule, RuleChanges } from "@/models/Rule";
import { ErrorMessages } from "@/services/ErrorMessages";
import { RuleService } from "@/services/RuleService";

import styles from "./Rules.module.css";

export interface RulesProps {
  service?: RuleService;
}

/** UC-05: view the business rules and adjust their thresholds. Changes apply at the next
 * evaluation; alerts already raised keep the threshold in force when they were triggered. */
export default function Rules({ service }: RulesProps) {
  const { t } = usePreferences();
  const toast = useToast();
  const api = useMemo(() => service ?? new RuleService(), [service]);
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [error, setError] = useState<TranslationKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .list()
      .then((loaded) => {
        if (!cancelled) setRules(loaded);
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(ErrorMessages.SUPERVISOR.key(failure));
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  async function onSave(code: string, changes: RuleChanges) {
    try {
      const updated = await api.update(code, changes);
      setRules((current) => current?.map((rule) => (rule.code === code ? updated : rule)) ?? null);
      toast.notify({ message: t("rules.toast.saved", { code }) });
    } catch (failure) {
      toast.notify({ message: t(ErrorMessages.SUPERVISOR.key(failure)), tone: "error" });
    }
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{t("rules.title")}</h1>
      <Notice>{t("rules.intro")}</Notice>
      {error && <Notice variant="danger">{t(error)}</Notice>}
      {rules === null && !error && <p role="status">{t("rules.loading")}</p>}
      {rules !== null && rules.length === 0 && (
        <EmptyState kind="results" title={t("rules.title")}>
          {t("rules.empty")}
        </EmptyState>
      )}
      {rules !== null && rules.length > 0 && (
        <div className={styles.grid}>
          {rules.map((rule) => (
            // The card starts again from the saved rule: its own changes are no longer pending.
            <RuleCard key={`${rule.code}-${rule.updatedAt.getTime()}`} rule={rule} onSave={onSave} />
          ))}
        </div>
      )}
    </main>
  );
}

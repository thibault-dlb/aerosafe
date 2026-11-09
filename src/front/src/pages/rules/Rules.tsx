import { type FormEvent, useEffect, useMemo, useState } from "react";

import type { Criticality } from "@/models/Alert";
import type { Rule, RuleChanges } from "@/models/Rule";
import { RuleService } from "@/services/RuleService";

import { errorMessage } from "../alerts/errorMessage";

export interface RulesProps {
  service?: RuleService;
}

interface RuleRowProps {
  rule: Rule;
  onSave: (code: string, changes: RuleChanges) => Promise<void>;
}

/** One rule and its settings form. Only the changed settings are sent. */
function RuleRow({ rule, onSave }: RuleRowProps) {
  const [threshold, setThreshold] = useState(String(rule.threshold));
  const [criticality, setCriticality] = useState<"" | Criticality>(rule.criticality ?? "");
  const [active, setActive] = useState(rule.isActive);
  const [saving, setSaving] = useState(false);

  const value = Number(threshold);
  const valid = threshold.trim() !== "" && Number.isFinite(value) && value >= 0;
  const changes: RuleChanges = {};
  if (valid && value !== rule.threshold) changes.threshold = value;
  if ((criticality || null) !== rule.criticality) changes.criticality = criticality || null;
  if (active !== rule.isActive) changes.is_active = active;
  const changed = Object.keys(changes).length > 0;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(rule.code, changes);
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr>
      <th scope="row">{rule.code}</th>
      <td>{rule.description}</td>
      <td>
        <form id={`rule-${rule.code}`} onSubmit={onSubmit} aria-label={`Settings of ${rule.code}`}>
          <label>
            Threshold of {rule.code} ({rule.unit})
            <input
              type="number"
              min={0}
              step="any"
              value={threshold}
              onChange={(event) => setThreshold(event.target.value)}
              aria-invalid={!valid}
            />
          </label>
        </form>
      </td>
      <td>
        <label>
          Criticality of {rule.code}
          <select
            form={`rule-${rule.code}`}
            value={criticality}
            onChange={(event) => setCriticality(event.target.value as "" | Criticality)}
          >
            <option value="">None</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </label>
      </td>
      <td>
        <label>
          <input
            type="checkbox"
            form={`rule-${rule.code}`}
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          {rule.code} evaluated
        </label>
      </td>
      <td>{rule.updatedAt.toLocaleString()}</td>
      <td>
        <button type="submit" form={`rule-${rule.code}`} disabled={!valid || !changed || saving}>
          {saving ? "Saving…" : `Save ${rule.code}`}
        </button>
      </td>
    </tr>
  );
}

/** UC-05: view the business rules and adjust their thresholds. Changes apply at the next
 * evaluation; alerts already raised keep the threshold in force when they were triggered. */
export default function Rules({ service }: RulesProps) {
  const api = useMemo(() => service ?? new RuleService(), [service]);
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .list()
      .then((loaded) => {
        if (!cancelled) setRules(loaded);
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(errorMessage(failure));
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  async function onSave(code: string, changes: RuleChanges) {
    setError(null);
    setNotice(null);
    try {
      const updated = await api.update(code, changes);
      setRules((current) => current?.map((rule) => (rule.code === code ? updated : rule)) ?? null);
      setNotice(`${code} saved. The change applies at the next evaluation.`);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  return (
    <main>
      <h1>Rules</h1>
      <p>
        A rule raises an alert when the observed value is above its threshold. Changes apply at
        the next evaluation.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {rules === null && !error && <p role="status">Loading rules…</p>}
      {rules !== null && (
        <table>
          <thead>
            <tr>
              <th scope="col">Rule</th>
              <th scope="col">Detects</th>
              <th scope="col">Threshold</th>
              <th scope="col">Criticality</th>
              <th scope="col">Active</th>
              <th scope="col">Last change</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <RuleRow key={`${rule.code}-${rule.updatedAt.getTime()}`} rule={rule} onSave={onSave} />
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

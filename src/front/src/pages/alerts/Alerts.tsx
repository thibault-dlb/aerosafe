import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import AlertTable from "@/components/alerts/AlertTable";
import type { Alert, AlertPage } from "@/models/Alert";
import { AlertService, type AlertSort } from "@/services/AlertService";
import { ErrorMessages } from "@/services/ErrorMessages";
import { Formatter } from "@/services/Formatter";
import { RuleService } from "@/services/RuleService";

import { AlertCriteria, type Criteria } from "./AlertCriteria";

const { PAGE_SIZE } = AlertCriteria;

export interface AlertsProps {
  service?: AlertService;
  ruleService?: RuleService;
}

/** UC-04: view, filter and sort alerts, open their details and mark them as processed. */
export default function Alerts({ service, ruleService }: AlertsProps) {
  const api = useMemo(() => service ?? new AlertService(), [service]);
  const rulesApi = useMemo(() => ruleService ?? new RuleService(), [ruleService]);
  // Read from the API, so a rule added to REGLE shows up without changing this page (NF-06).
  const [ruleCodes, setRuleCodes] = useState<string[]>([]);
  const [criteria, setCriteria] = useState<Criteria>(AlertCriteria.DEFAULT);
  const [applied, setApplied] = useState<Criteria>(AlertCriteria.DEFAULT);
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<AlertPage | null>(null);
  const [selected, setSelected] = useState<Alert | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Number of the latest search: an older answer arriving late must not replace it.
  const latestSearch = useRef(0);

  const load = useCallback(async () => {
    const search = ++latestSearch.current;
    setLoading(true);
    setError(null);
    try {
      const result = await api.search(AlertCriteria.toFilters(applied, offset));
      if (search !== latestSearch.current) return;
      if (result.items.length === 0 && offset > 0) {
        // The page emptied, for instance after processing its last alert: show the last
        // page that still has alerts instead of an empty page without navigation. Always
        // at least one page back, so the search ends even if the total is already stale.
        const lastPage = Math.max(0, Math.ceil(result.total / PAGE_SIZE) - 1) * PAGE_SIZE;
        setOffset(Math.max(0, Math.min(lastPage, offset - PAGE_SIZE)));
        return;
      }
      setPage(result);
    } catch (failure) {
      if (search !== latestSearch.current) return;
      setPage(null);
      setError(ErrorMessages.SUPERVISOR.describe(failure));
    } finally {
      if (search === latestSearch.current) setLoading(false);
    }
  }, [api, applied, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    rulesApi.list().then(
      (rules) => {
        if (!cancelled) setRuleCodes(rules.map((rule) => rule.code));
      },
      // Without the list, the filter still offers "All rules"; the alert list says why.
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [rulesApi]);

  function update<K extends keyof Criteria>(key: K, value: Criteria[K]) {
    setCriteria((current) => ({ ...current, [key]: value }));
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (AlertCriteria.periodReversed(criteria)) {
      setError("The start of the period must not be after its end.");
      return;
    }
    setSelected(null);
    setOffset(0);
    setApplied(criteria);
  }

  async function onProcess(alert: Alert) {
    setProcessingId(alert.id);
    setError(null);
    try {
      const processed = await api.process(alert.id);
      if (selected?.id === alert.id) setSelected(processed);
      await load();
    } catch (failure) {
      setError(ErrorMessages.SUPERVISOR.describe(failure));
    } finally {
      setProcessingId(null);
    }
  }

  const total = page?.total ?? 0;
  const lastShown = Math.min(offset + PAGE_SIZE, total);

  return (
    <main>
      <h1>Alerts</h1>
      <form onSubmit={onSubmit} aria-label="Alert filters">
        <label>
          Rule
          <select value={criteria.rule} onChange={(event) => update("rule", event.target.value)}>
            <option value="">All rules</option>
            {ruleCodes.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            value={criteria.status}
            onChange={(event) => update("status", event.target.value as Criteria["status"])}
          >
            <option value="">All alerts</option>
            <option value="unprocessed">Not processed</option>
            <option value="active">Situation still active</option>
            <option value="processed">Processed</option>
          </select>
        </label>
        <label>
          Criticality
          <select
            value={criteria.criticality}
            onChange={(event) =>
              update("criticality", event.target.value as Criteria["criticality"])
            }
          >
            <option value="">All levels</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </label>
        <label>
          ICAO24 address
          <input
            value={criteria.icao24}
            onChange={(event) => update("icao24", event.target.value)}
            pattern="[0-9a-fA-F]{1,6}"
            maxLength={6}
            placeholder="3c6444"
          />
        </label>
        <label>
          From
          <input
            type="datetime-local"
            value={criteria.start}
            onChange={(event) => update("start", event.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="datetime-local"
            value={criteria.end}
            onChange={(event) => update("end", event.target.value)}
          />
        </label>
        <label>
          Sort by
          <select
            value={criteria.sort}
            onChange={(event) => update("sort", event.target.value as AlertSort)}
          >
            <option value="triggered_at">Date</option>
            <option value="criticality">Criticality</option>
            <option value="rule">Rule</option>
          </select>
        </label>
        <label>
          Order
          <select
            value={criteria.order}
            onChange={(event) => update("order", event.target.value as Criteria["order"])}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
        <button type="submit" disabled={loading}>
          Apply
        </button>
      </form>

      {error && <p role="alert">{error}</p>}
      {loading && page === null && <p role="status">Loading alerts…</p>}

      {page !== null && page.items.length === 0 && (
        <p role="status">No alert matches these criteria.</p>
      )}

      {page !== null && page.items.length > 0 && (
        <>
          <AlertTable
            alerts={page.items}
            caption={`Alerts ${offset + 1} to ${lastShown} of ${total}`}
            onSelect={setSelected}
            onProcess={onProcess}
            processingId={processingId}
          />
          <nav aria-label="Alert pages">
            <button
              type="button"
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0 || loading}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={lastShown >= total || loading}
            >
              Next
            </button>
          </nav>
        </>
      )}

      {selected && (
        <section aria-label="Alert details">
          <h2>
            {selected.ruleCode}: {selected.ruleDescription}
          </h2>
          <dl>
            <dt>Aircraft</dt>
            <dd>
              <Link to={`/aircraft/${selected.aircraftId}`}>{selected.aircraftName}</Link> (
              {selected.icao24})
            </dd>
            <dt>Triggered at</dt>
            <dd>{selected.triggeredAt.toLocaleString()}</dd>
            <dt>Observed value</dt>
            <dd>{Formatter.rounded(selected.observedValue, selected.unit)}</dd>
            <dt>Threshold</dt>
            <dd>{Formatter.rounded(selected.threshold, selected.unit)}</dd>
            <dt>Criticality</dt>
            <dd>{selected.criticality ?? "None"}</dd>
            <dt>Situation ended at</dt>
            <dd>{selected.episodeEndedAt?.toLocaleString() ?? "Still active"}</dd>
            <dt>Status</dt>
            <dd>
              {selected.statusLabel}
              {selected.processedAt && ` on ${selected.processedAt.toLocaleString()}`}
            </dd>
            <dt>Message</dt>
            <dd>{selected.message}</dd>
          </dl>
          <p>
            Not relevant? <Link to="/rules">Adjust the threshold of {selected.ruleCode}</Link>.
          </p>
          <button type="button" onClick={() => setSelected(null)}>
            Close
          </button>
        </section>
      )}
    </main>
  );
}

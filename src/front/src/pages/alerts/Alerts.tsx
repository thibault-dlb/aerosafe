import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import AlertDetail from "@/components/alerts/AlertDetail";
import AlertTable from "@/components/alerts/AlertTable";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import CriticalityMark from "@/components/ui/CriticalityMark";
import EmptyState from "@/components/ui/EmptyState";
import Field from "@/components/ui/Field";
import Fold from "@/components/ui/Fold";
import Icon from "@/components/ui/Icon";
import Notice from "@/components/ui/Notice";
import Pagination from "@/components/ui/Pagination";
import { usePreferences } from "@/hooks/usePreferences";
import { useToast } from "@/hooks/useToast";
import type { TranslationKey } from "@/i18n/fr";
import type { Alert, AlertPage, Criticality } from "@/models/Alert";
import { AlertService, type AlertSort, type AlertStatus } from "@/services/AlertService";
import { ErrorMessages } from "@/services/ErrorMessages";
import { RuleService } from "@/services/RuleService";

import { AlertCriteria, type Criteria } from "./AlertCriteria";
import styles from "./Alerts.module.css";

const { PAGE_SIZE } = AlertCriteria;

const STATUSES: { value: "" | AlertStatus; label: TranslationKey }[] = [
  { value: "unprocessed", label: "alerts.status.unprocessed" },
  { value: "active", label: "alerts.status.active" },
  { value: "processed", label: "alerts.status.processed" },
  { value: "", label: "alerts.status.all" },
];

const CRITICALITIES: Criticality[] = ["HIGH", "MEDIUM", "LOW"];

/** The sort a column starts with: a rule reads A to Z, the others show the largest or latest first. */
const FIRST_ORDER: Record<AlertSort, "asc" | "desc"> = {
  triggered_at: "desc",
  criticality: "desc",
  rule: "asc",
};

/** The filters of the form under "More filters": the others apply as soon as they are chosen. */
type MoreFilters = Pick<Criteria, "rule" | "icao24" | "start" | "end">;

function moreFiltersOf(criteria: Criteria): MoreFilters {
  const { rule, icao24, start, end } = criteria;
  return { rule, icao24, start, end };
}

export interface AlertsProps {
  service?: AlertService;
  ruleService?: RuleService;
}

/** UC-04: view, filter and sort alerts, open their details and mark them as processed. */
export default function Alerts({ service, ruleService }: AlertsProps) {
  const { t } = usePreferences();
  const toast = useToast();
  const api = useMemo(() => service ?? new AlertService(), [service]);
  const rulesApi = useMemo(() => ruleService ?? new RuleService(), [ruleService]);
  // Read from the API, so a rule added to REGLE shows up without changing this page (NF-06).
  const [ruleCodes, setRuleCodes] = useState<string[]>([]);
  const [applied, setApplied] = useState<Criteria>(AlertCriteria.DEFAULT);
  const [more, setMore] = useState<MoreFilters>(moreFiltersOf(AlertCriteria.DEFAULT));
  const [showMore, setShowMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<AlertPage | null>(null);
  // Offset of the rows in `page`: `offset` moves as soon as a page is asked for, while the
  // rows only change once its search answers.
  const [pageOffset, setPageOffset] = useState(0);
  const [selected, setSelected] = useState<Alert | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [loading, setLoading] = useState(false);
  const detail = useRef<HTMLDivElement>(null);

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
      setPageOffset(offset);
    } catch (failure) {
      if (search !== latestSearch.current) return;
      setPage(null);
      setError(ErrorMessages.SUPERVISOR.key(failure));
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

  // On a narrow page the details open under the list: bring them into view.
  useEffect(() => {
    if (selected) detail.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [selected]);

  /** Applies new criteria: back to the first page, and the details of an old result close. */
  function apply(changes: Partial<Criteria>) {
    setApplied((current) => ({ ...current, ...changes }));
    setOffset(0);
    setSelected(null);
  }

  function onMoreSubmit(event: FormEvent) {
    event.preventDefault();
    if (AlertCriteria.periodReversed({ ...applied, ...more })) {
      setError("alerts.periodReversed");
      return;
    }
    apply(more);
  }

  function clearFilters() {
    setMore(moreFiltersOf(AlertCriteria.DEFAULT));
    apply(AlertCriteria.DEFAULT);
  }

  function onSort(key: AlertSort) {
    if (applied.sort === key) apply({ order: applied.order === "asc" ? "desc" : "asc" });
    else apply({ sort: key, order: FIRST_ORDER[key] });
  }

  async function onProcess(alert: Alert) {
    setProcessingId(alert.id);
    setError(null);
    try {
      const processed = await api.process(alert.id);
      if (selected?.id === alert.id) setSelected(processed);
      toast.notify({ message: t("alerts.toast.processed", { rule: alert.ruleCode, aircraft: alert.aircraftName }) });
      await load();
    } catch (failure) {
      toast.notify({ message: t(ErrorMessages.SUPERVISOR.key(failure)), tone: "error" });
    } finally {
      setProcessingId(null);
    }
  }

  const total = page?.total ?? 0;

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{t("alerts.title")}</h1>

      <div className={styles.filters} role="group" aria-label={t("alerts.filters")}>
        {STATUSES.map((status) => (
          <Chip key={status.label} pressed={applied.status === status.value} onClick={() => apply({ status: status.value })}>
            {t(status.label)}
          </Chip>
        ))}
        <span className={styles.separator} aria-hidden="true" />
        {CRITICALITIES.map((level) => (
          <Chip
            key={level}
            pressed={applied.criticality === level}
            onClick={() => apply({ criticality: applied.criticality === level ? "" : level })}
          >
            <CriticalityMark level={level} variant="label" />
          </Chip>
        ))}
        <span className={styles.separator} aria-hidden="true" />
        <Chip pressed={showMore} onClick={() => setShowMore((open) => !open)} aria-expanded={showMore}>
          <Icon name="filter" size={14} />
          {t("alerts.moreFilters")}
        </Chip>
        {page && (
          <span className={styles.count} role="status">
            {t(total === 1 ? "alerts.count.one" : "alerts.count.many", { count: total })}
          </span>
        )}
      </div>

      <Fold open={showMore}>
        <form className={styles.more} onSubmit={onMoreSubmit} aria-label={t("alerts.moreFilters")}>
          <label className={styles.select}>
            <span>{t("alerts.rule")}</span>
            <select value={more.rule} onChange={(event) => setMore({ ...more, rule: event.target.value })}>
              <option value="">{t("alerts.allRules")}</option>
              {ruleCodes.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
          <Field
            label={t("alerts.icao24")}
            value={more.icao24}
            onChange={(event) => setMore({ ...more, icao24: event.target.value })}
            pattern="[0-9a-fA-F]{1,6}"
            maxLength={6}
            placeholder="3c6444"
            className="mono"
          />
          <Field
            label={t("alerts.from")}
            type="datetime-local"
            value={more.start}
            onChange={(event) => setMore({ ...more, start: event.target.value })}
          />
          <Field
            label={t("alerts.to")}
            type="datetime-local"
            value={more.end}
            onChange={(event) => setMore({ ...more, end: event.target.value })}
          />
          <div className={styles.moreActions}>
            <Button type="submit" disabled={loading}>
              {t("alerts.apply")}
            </Button>
            <Button variant="secondary" onClick={clearFilters}>
              {t("alerts.clear")}
            </Button>
          </div>
        </form>
      </Fold>

      {error && <Notice variant="danger">{t(error)}</Notice>}
      {loading && page === null && !error && <p role="status">{t("alerts.loading")}</p>}

      {page !== null && page.items.length === 0 && (
        <EmptyState
          kind="alerts"
          title={t("alerts.empty.title")}
          action={
            <Button variant="secondary" onClick={clearFilters}>
              {t("alerts.clear")}
            </Button>
          }
        >
          {t("alerts.empty.text")}
        </EmptyState>
      )}

      {page !== null && page.items.length > 0 && (
        <div className={[styles.layout, selected && styles.withDetail].filter(Boolean).join(" ")}>
          <div className={styles.list}>
            <AlertTable
              alerts={page.items}
              onSelect={setSelected}
              onProcess={onProcess}
              processingId={processingId}
              selectedId={selected?.id ?? null}
              sorting={{ key: applied.sort, order: applied.order }}
              onSort={onSort}
              compact={selected !== null}
            />
            <Pagination offset={pageOffset} pageSize={PAGE_SIZE} total={total} busy={loading} onChange={setOffset} />
          </div>
          {selected && (
            <div ref={detail} className={styles.detail}>
              <AlertDetail
                alert={selected}
                onClose={() => setSelected(null)}
                onProcess={onProcess}
                processing={processingId === selected.id}
              />
            </div>
          )}
        </div>
      )}
    </main>
  );
}

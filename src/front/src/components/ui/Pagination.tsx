import { useTranslation } from "@/hooks/useTranslation";

import Icon from "./Icon";
import { PageNumbers } from "./PageNumbers";
import styles from "./Pagination.module.css";

export interface PaginationProps {
  /** Offset of the first row of the page shown. */
  offset: number;
  pageSize: number;
  /** Number of rows in all the pages. */
  total: number;
  /** Called with the offset of the page asked for. */
  onChange: (offset: number) => void;
  /** True while a page is being loaded. */
  busy?: boolean;
}

/** Moves between the pages of a list that the API cuts into pages (`offset` and `limit`). */
export default function Pagination({ offset, pageSize, total, onChange, busy = false }: PaginationProps) {
  const { t } = useTranslation();
  const count = PageNumbers.count(total, pageSize);
  const current = Math.floor(offset / pageSize) + 1;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + pageSize, total);
  const go = (page: number) => onChange((page - 1) * pageSize);

  return (
    <nav className={styles.pager} aria-label={t("pagination.label")}>
      <span className={styles.summary}>{t("pagination.summary", { from, to, total })}</span>
      <div className={styles.numbers}>
        <button
          type="button"
          className={`${styles.button} ${styles.previous}`}
          aria-label={t("pagination.previous")}
          disabled={current <= 1 || busy}
          onClick={() => go(current - 1)}
        >
          <Icon name="chevron" size={16} />
        </button>
        {PageNumbers.window(current, count).map((item, index) =>
          item === "gap" ? (
            <span key={`gap-${index}`} className={styles.gap} aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={styles.button}
              aria-label={t("pagination.page", { page: item })}
              aria-current={item === current ? "page" : undefined}
              disabled={busy}
              onClick={() => go(item)}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          className={styles.button}
          aria-label={t("pagination.next")}
          disabled={current >= count || busy}
          onClick={() => go(current + 1)}
        >
          <Icon name="chevron" size={16} />
        </button>
      </div>
    </nav>
  );
}

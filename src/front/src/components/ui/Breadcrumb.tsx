import { Fragment } from "react";
import { Link } from "react-router-dom";

import { useTranslation } from "@/hooks/useTranslation";

import Icon from "./Icon";
import styles from "./Breadcrumb.module.css";

export interface BreadcrumbItem {
  label: string;
  /** Where the item leads. The last item, the page itself, has none. */
  to?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

/** The way back up from a page: aircraft, then one aircraft, then one of its flights. */
export default function Breadcrumb({ items }: BreadcrumbProps) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t("breadcrumb.label")}>
      <ol className={styles.list}>
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <Fragment key={`${index}-${item.label}`}>
              <li>
                {item.to && !last ? (
                  <Link to={item.to} className={styles.link}>
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current={last ? "page" : undefined} className={last ? styles.current : undefined}>
                    {item.label}
                  </span>
                )}
              </li>
              {!last && (
                <li aria-hidden="true" className={styles.separator}>
                  <Icon name="chevron" size={12} />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

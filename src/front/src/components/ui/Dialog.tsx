import { type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

import { useTranslation } from "@/hooks/useTranslation";

import Icon from "./Icon";
import type { IconName } from "./IconSet";
import styles from "./Dialog.module.css";

export interface DialogProps {
  open: boolean;
  /** Names the dialog for screen readers and is its heading. */
  title: string;
  onClose: () => void;
  /** The explanation: what the action does and whether it can be undone. */
  children: ReactNode;
  /** The buttons, usually a cancel button and the button of the action. */
  actions: ReactNode;
  /** `danger` is for an action that cannot be undone. */
  tone?: "default" | "danger";
  icon?: IconName;
}

const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * A modal window that asks for a decision. Focus moves into it when it opens, stays inside while
 * it is open (Tab and Shift+Tab loop) and returns to where it was on close. Escape and a click on
 * the backdrop close it.
 */
export default function Dialog({ open, title, onClose, children, actions, tone = "default", icon }: DialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const element = panel.current;
    // The first field or button of the content, so the user can type at once; the panel itself otherwise.
    const body = element?.querySelector("[data-dialog-body]");
    const first = body?.querySelector<HTMLElement>("input:not(:disabled), select:not(:disabled), textarea:not(:disabled)");
    (first ?? element?.querySelector<HTMLElement>(FOCUSABLE) ?? element)?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      close.current();
      return;
    }
    if (event.key !== "Tab" || !panel.current) return;
    // Every element in document order, filtered: a grouped selector does not promise that order.
    const items = [...panel.current.querySelectorAll<HTMLElement>("*")].filter((element) => element.matches(FOCUSABLE));
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const firstItem = items[0];
    const lastItem = items[items.length - 1];
    if (event.shiftKey && document.activeElement === firstItem) {
      event.preventDefault();
      lastItem.focus();
    } else if (!event.shiftKey && document.activeElement === lastItem) {
      event.preventDefault();
      firstItem.focus();
    }
  }

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close.current();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={[styles.dialog, tone === "danger" && styles.danger].filter(Boolean).join(" ")}
        onKeyDown={onKeyDown}
      >
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {icon && <Icon name={icon} size={20} />}
            {title}
          </h2>
          <button type="button" className={styles.close} aria-label={t("dialog.close")} onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </header>
        <div className={styles.body} data-dialog-body>
          {children}
        </div>
        <footer className={styles.actions}>{actions}</footer>
      </div>
    </div>,
    document.body,
  );
}

import { createContext } from "react";

export type ToastTone = "success" | "error";

/** What a page asks to show. The text is already translated. */
export interface ToastInput {
  message: string;
  /** `error` stays longer and is announced to screen readers at once. */
  tone?: ToastTone;
  /** A button in the notification, for example "Undo" or "Retry". */
  action?: { label: string; onAction: () => void };
  /** How long it stays, in milliseconds. */
  durationMs?: number;
}

export interface Toasts {
  /** Shows a notification and returns its identifier. */
  notify: (toast: ToastInput) => number;
  dismiss: (id: number) => void;
}

export const ToastContext = createContext<Toasts | null>(null);

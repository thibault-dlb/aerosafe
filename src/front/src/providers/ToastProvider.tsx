import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import Toast from "@/components/ui/Toast";
import { type ToastInput, ToastContext, type Toasts } from "@/providers/ToastContext";

import styles from "./ToastProvider.module.css";

/** How long a success stays, and an error, which the user must have time to read. */
export const SUCCESS_MS = 5000;
export const ERROR_MS = 8000;
/** The most notifications on screen: the oldest goes when a new one comes. */
export const MAX_TOASTS = 4;

interface Shown extends ToastInput {
  id: number;
}

/** Shows the floating notifications at the bottom right of the window. */
export default function ToastProvider({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<Shown[]>([]);
  const next = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setShown((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (input: ToastInput) => {
      const id = next.current++;
      const duration = input.durationMs ?? (input.tone === "error" || input.action ? ERROR_MS : SUCCESS_MS);
      setShown((current) => {
        const kept = current.slice(-(MAX_TOASTS - 1));
        for (const gone of current.slice(0, current.length - kept.length)) {
          clearTimeout(timers.current.get(gone.id));
          timers.current.delete(gone.id);
        }
        return [...kept, { ...input, id }];
      });
      timers.current.set(id, setTimeout(() => dismiss(id), duration));
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  const value = useMemo<Toasts>(() => ({ notify, dismiss }), [notify, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.zone}>
        {shown.map((toast) => (
          <Toast key={toast.id} message={toast.message} tone={toast.tone} action={toast.action} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

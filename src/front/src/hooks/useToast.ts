import { useContext } from "react";

import { ToastContext, type Toasts } from "@/providers/ToastContext";

/** Shows the floating notifications that confirm or refuse an action. Needs `ToastProvider`. */
export function useToast(): Toasts {
  const toasts = useContext(ToastContext);
  if (!toasts) {
    throw new Error("useToast must be used under ToastProvider");
  }
  return toasts;
}

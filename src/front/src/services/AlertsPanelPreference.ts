import { PreferenceStore } from "@/services/PreferenceStore";

/**
 * Whether the visitor left the active alerts panel of the dashboard open or folded. Remembered in
 * the browser, so a reload of the page keeps the choice.
 */
export class AlertsPanelPreference {
  static readonly KEY = "aerosafe.alertsPanel";

  constructor(private readonly store: PreferenceStore = new PreferenceStore()) {}

  /** The remembered state, or `fallback` while the visitor has not chosen yet. */
  isOpen(fallback: boolean): boolean {
    const saved = this.store.get(AlertsPanelPreference.KEY);
    if (saved === "open") return true;
    if (saved === "folded") return false;
    return fallback;
  }

  setOpen(open: boolean): void {
    this.store.set(AlertsPanelPreference.KEY, open ? "open" : "folded");
  }
}

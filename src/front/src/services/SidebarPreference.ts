import { PreferenceStore } from "@/services/PreferenceStore";

/** Whether the visitor folded the side bar into a rail of icons. Remembered in the browser. */
export class SidebarPreference {
  static readonly KEY = "aerosafe.sidebar";

  constructor(private readonly store: PreferenceStore = new PreferenceStore()) {}

  isFolded(): boolean {
    return this.store.get(SidebarPreference.KEY) === "folded";
  }

  setFolded(folded: boolean): void {
    this.store.set(SidebarPreference.KEY, folded ? "folded" : "open");
  }
}

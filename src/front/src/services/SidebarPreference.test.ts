import { describe, expect, it } from "vitest";

import { PreferenceStore } from "./PreferenceStore";
import { SidebarPreference } from "./SidebarPreference";

function memoryStore(): PreferenceStore {
  const values = new Map<string, string>();
  return new PreferenceStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  });
}

describe("SidebarPreference", () => {
  it("is open until the visitor folds it", () => {
    expect(new SidebarPreference(memoryStore()).isFolded()).toBe(false);
  });

  it("remembers the choice", () => {
    const store = memoryStore();

    new SidebarPreference(store).setFolded(true);
    expect(new SidebarPreference(store).isFolded()).toBe(true);

    new SidebarPreference(store).setFolded(false);
    expect(new SidebarPreference(store).isFolded()).toBe(false);
  });

  it("keeps working when the browser remembers nothing", () => {
    const preference = new SidebarPreference(new PreferenceStore(null));

    preference.setFolded(true);

    expect(preference.isFolded()).toBe(false);
  });
});

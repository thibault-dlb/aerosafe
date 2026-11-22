import { describe, expect, it } from "vitest";

import { AlertsPanelPreference } from "./AlertsPanelPreference";
import { PreferenceStore } from "./PreferenceStore";

function memoryStore(): PreferenceStore {
  const values = new Map<string, string>();
  return new PreferenceStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  });
}

describe("AlertsPanelPreference", () => {
  it("gives the fallback until the visitor chooses", () => {
    const preference = new AlertsPanelPreference(memoryStore());

    expect(preference.isOpen(true)).toBe(true);
    expect(preference.isOpen(false)).toBe(false);
  });

  it("remembers the choice, whatever the fallback", () => {
    const store = memoryStore();

    new AlertsPanelPreference(store).setOpen(false);
    expect(new AlertsPanelPreference(store).isOpen(true)).toBe(false);

    new AlertsPanelPreference(store).setOpen(true);
    expect(new AlertsPanelPreference(store).isOpen(false)).toBe(true);
  });

  it("keeps working when the browser remembers nothing", () => {
    const preference = new AlertsPanelPreference(new PreferenceStore(null));

    preference.setOpen(false);

    expect(preference.isOpen(true)).toBe(true);
  });
});

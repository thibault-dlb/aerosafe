import { describe, expect, it } from "vitest";

import { PreferenceStore } from "./PreferenceStore";
import { UnitService } from "./UnitService";

function memoryStore(): PreferenceStore {
  const values = new Map<string, string>();
  return new PreferenceStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  });
}

describe("UnitService", () => {
  it("is metric until the user chooses", () => {
    expect(new UnitService(memoryStore()).current()).toBe("metric");
  });

  it("remembers the choice", () => {
    const store = memoryStore();
    new UnitService(store).set("aeronautical");

    expect(new UnitService(store).current()).toBe("aeronautical");
  });

  it("ignores a stored value it does not know", () => {
    const store = memoryStore();
    store.set(UnitService.KEY, "imperial");

    expect(new UnitService(store).current()).toBe("metric");
    expect(UnitService.isSystem(null)).toBe(false);
  });
});

import { afterEach, describe, expect, it } from "vitest";

import { DataModeService } from "./DataModeService";
import { PreferenceStore } from "./PreferenceStore";

function memoryStore(initial: Record<string, string> = {}): PreferenceStore {
  const values = new Map(Object.entries(initial));
  return new PreferenceStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  });
}

/** A storage that is blocked, as in a private window. */
function blockedStore(): PreferenceStore {
  return new PreferenceStore(null);
}

afterEach(() => DataModeService.reset());

describe("DataModeService", () => {
  it("shows the live data until the replay is chosen", () => {
    expect(new DataModeService(memoryStore()).current()).toBe("live");
  });

  it("remembers the replay for the next visit", () => {
    const store = memoryStore();
    new DataModeService(store).set("replay");
    DataModeService.reset();

    expect(new DataModeService(store).current()).toBe("replay");
  });

  it("ignores a stored value that is not a mode", () => {
    const service = new DataModeService(memoryStore({ [DataModeService.KEY]: "tomorrow" }));

    expect(service.current()).toBe("live");
  });

  it("can go back to the live data", () => {
    const service = new DataModeService(memoryStore());
    service.set("replay");
    service.set("live");

    expect(service.current()).toBe("live");
  });

  it("is followed by the other instances even when nothing can be stored", () => {
    new DataModeService(blockedStore()).set("replay");

    expect(new DataModeService(blockedStore()).current()).toBe("replay");
  });

  it("recognises the two modes only", () => {
    expect(DataModeService.isMode("live")).toBe(true);
    expect(DataModeService.isMode("replay")).toBe(true);
    expect(DataModeService.isMode("other")).toBe(false);
    expect(DataModeService.isMode(null)).toBe(false);
  });
});

describe("withSource", () => {
  it("leaves the live requests alone", () => {
    const service = new DataModeService(memoryStore());

    expect(service.withSource("")).toBe("");
    expect(service.withSource("?limit=5")).toBe("?limit=5");
  });

  it("marks the replay requests, with or without other parameters", () => {
    const service = new DataModeService(memoryStore());
    service.set("replay");

    expect(service.isReplay()).toBe(true);
    expect(service.withSource("")).toBe("?source=replay");
    expect(service.withSource("?limit=5")).toBe("?limit=5&source=replay");
  });
});

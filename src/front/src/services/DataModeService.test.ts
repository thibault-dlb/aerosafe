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
  it("shows adsb.fi until another source is chosen", () => {
    expect(new DataModeService(memoryStore()).current()).toBe("adsbfi");
  });

  it("remembers the replay for the next visit", () => {
    const store = memoryStore();
    new DataModeService(store).set("replay");
    DataModeService.reset();

    expect(new DataModeService(store).current()).toBe("replay");
  });

  it("ignores a stored value that is not a mode, the former live one included", () => {
    for (const stored of ["tomorrow", "live"]) {
      const service = new DataModeService(memoryStore({ [DataModeService.KEY]: stored }));

      expect(service.current()).toBe("adsbfi");
    }
  });

  it("can go back to a live source", () => {
    const service = new DataModeService(memoryStore());
    service.set("replay");
    service.set("opensky");

    expect(service.current()).toBe("opensky");
  });

  it("is followed by the other instances even when nothing can be stored", () => {
    new DataModeService(blockedStore()).set("replay");

    expect(new DataModeService(blockedStore()).current()).toBe("replay");
  });

  it("recognises the three modes only", () => {
    for (const mode of ["opensky", "adsbfi", "replay"]) {
      expect(DataModeService.isMode(mode)).toBe(true);
    }
    expect(DataModeService.isMode("live")).toBe(false);
    expect(DataModeService.isMode(null)).toBe(false);
  });
});

describe("withSource", () => {
  it("names the source of every request, with or without other parameters", () => {
    const service = new DataModeService(memoryStore());

    expect(service.withSource("")).toBe("?source=adsbfi");
    expect(service.withSource("?limit=5")).toBe("?limit=5&source=adsbfi");
  });

  it("marks the replay requests", () => {
    const service = new DataModeService(memoryStore());
    service.set("replay");

    expect(service.isReplay()).toBe(true);
    expect(service.withSource("?limit=5")).toBe("?limit=5&source=replay");
  });

  it("marks the OpenSky requests", () => {
    const service = new DataModeService(memoryStore());
    service.set("opensky");

    expect(service.isReplay()).toBe(false);
    expect(service.withSource("")).toBe("?source=opensky");
  });
});

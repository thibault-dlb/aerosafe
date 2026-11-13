import { describe, expect, it, vi } from "vitest";

import { PreferenceStore, type StorageLike } from "./PreferenceStore";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const BROKEN: StorageLike = {
  getItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("blocked");
  },
};

describe("PreferenceStore", () => {
  it("returns what was stored", () => {
    const store = new PreferenceStore(new MemoryStorage());

    store.set("language", "en");

    expect(store.get("language")).toBe("en");
  });

  it("returns null for an unknown key", () => {
    expect(new PreferenceStore(new MemoryStorage()).get("missing")).toBeNull();
  });

  it("keeps working when the storage throws", () => {
    const store = new PreferenceStore(BROKEN);

    expect(() => store.set("language", "en")).not.toThrow();
    expect(store.get("language")).toBeNull();
  });

  it("keeps working without any storage", () => {
    const store = new PreferenceStore(null);

    store.set("language", "en");

    expect(store.get("language")).toBeNull();
  });

  it("uses the browser storage by default", () => {
    const browser = new MemoryStorage();
    vi.stubGlobal("localStorage", browser);
    const store = new PreferenceStore();

    store.set("theme", "light");

    expect(browser.getItem("theme")).toBe("light");
    vi.unstubAllGlobals();
  });

  it("works when the browser refuses to give its storage", () => {
    vi.stubGlobal("localStorage", undefined);
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    const store = new PreferenceStore();

    expect(() => store.set("theme", "light")).not.toThrow();
    expect(store.get("theme")).toBeNull();
    vi.unstubAllGlobals();
  });
});

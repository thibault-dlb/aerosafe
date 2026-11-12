import { describe, expect, it } from "vitest";

import { en } from "@/i18n/en";
import { fr } from "@/i18n/fr";

import { PreferenceStore } from "./PreferenceStore";
import { LANGUAGES, TranslationService } from "./TranslationService";

function memoryStore(initial?: string): PreferenceStore {
  const values = new Map<string, string>();
  if (initial) values.set(TranslationService.KEY, initial);
  return new PreferenceStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  });
}

describe("TranslationService", () => {
  it("speaks French by default", () => {
    const service = new TranslationService(memoryStore(), document.createElement("html"));

    expect(service.current()).toBe("fr");
    expect(service.t("nav.alerts")).toBe("Alertes");
  });

  it("uses the saved language", () => {
    const service = new TranslationService(memoryStore("en"), document.createElement("html"));

    expect(service.t("nav.alerts")).toBe("Alerts");
  });

  it("ignores an invalid saved language", () => {
    const service = new TranslationService(memoryStore("de"), document.createElement("html"));

    expect(service.current()).toBe("fr");
  });

  it("switches language, remembers it and updates the page language", () => {
    const root = document.createElement("html");
    const store = memoryStore();
    const service = new TranslationService(store, root);

    service.set("en");

    expect(service.t("nav.login")).toBe("Log in");
    expect(root.lang).toBe("en");
    expect(new TranslationService(store, root).current()).toBe("en");
  });

  it("sets the page language at start-up", () => {
    const root = document.createElement("html");

    new TranslationService(memoryStore(), root);

    expect(root.lang).toBe("fr");
  });

  it("fills the placeholders and leaves unknown ones", () => {
    const dictionaries = {
      fr: { ...fr, "nav.home": "Bonjour {name}, {missing}" },
      en,
    };
    const service = new TranslationService(memoryStore(), document.createElement("html"), dictionaries);

    expect(service.t("nav.home", { name: "Léa" })).toBe("Bonjour Léa, {missing}");
  });

  it("returns the key of a text that does not exist", () => {
    const service = new TranslationService(memoryStore(), document.createElement("html"));

    expect(service.t("unknown.key" as never)).toBe("unknown.key");
  });

  it("has the same keys in every language", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
    expect(LANGUAGES).toEqual(["fr", "en"]);
  });
});

import { describe, expect, it } from "vitest";

import { fr } from "@/i18n/fr";
import type { TranslationKey } from "@/i18n/fr";

import { RuleLabels } from "./RuleLabels";

const t = (key: TranslationKey) => fr[key];

describe("RuleLabels", () => {
  it("names and describes the five rules of the interface", () => {
    expect(RuleLabels.name("R3", "Variation importante d'altitude", t)).toBe("Variation d'altitude");
    expect(RuleLabels.detects("R1", "x", t)).toMatch(/Aucun message reçu/);
    for (const code of ["R1", "R2", "R3", "R4", "R5"]) {
      expect(RuleLabels.known(code)).toBe(true);
    }
  });

  it("shows the description of the API for a rule added later", () => {
    expect(RuleLabels.known("R6")).toBe(false);
    expect(RuleLabels.name("R6", "Vitesse au sol excessive", t)).toBe("Vitesse au sol excessive");
    expect(RuleLabels.detects("R6", "Vitesse au sol excessive", t)).toBe("Vitesse au sol excessive");
  });

  it("falls back on the code when a new rule has no description either", () => {
    expect(RuleLabels.name("R6", "", t)).toBe("R6");
  });
});

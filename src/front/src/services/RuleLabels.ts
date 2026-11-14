import type { TranslationKey } from "@/i18n/fr";

type Translate = (key: TranslationKey) => string;

/**
 * What a rule is called and what it detects, in the language of the interface. The engine can
 * hold more rules than the interface knows (NF-06): a rule it has no text for shows the
 * description the API gives.
 */
export class RuleLabels {
  private static readonly KNOWN: readonly string[] = ["R1", "R2", "R3", "R4", "R5"];

  static known(code: string): boolean {
    return RuleLabels.KNOWN.includes(code);
  }

  static name(code: string, description: string, t: Translate): string {
    return RuleLabels.known(code) ? t(`rule.${code}.name` as TranslationKey) : description || code;
  }

  static detects(code: string, description: string, t: Translate): string {
    return RuleLabels.known(code) ? t(`rule.${code}.detects` as TranslationKey) : description;
  }
}

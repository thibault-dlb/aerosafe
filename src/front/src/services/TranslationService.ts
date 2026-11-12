import { en } from "@/i18n/en";
import { fr, type TranslationKey } from "@/i18n/fr";
import { PreferenceStore } from "@/services/PreferenceStore";

export type Language = "fr" | "en";

export const LANGUAGES: readonly Language[] = ["fr", "en"];

const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = { fr, en };

/** Texts of the interface in the language chosen by the user. French is the default. */
export class TranslationService {
  static readonly KEY = "aerosafe.language";
  static readonly DEFAULT: Language = "fr";

  private language: Language;

  constructor(
    private readonly store: PreferenceStore = new PreferenceStore(),
    private readonly root: HTMLElement = document.documentElement,
    private readonly dictionaries: Record<Language, Record<TranslationKey, string>> = DICTIONARIES,
  ) {
    const stored = this.store.get(TranslationService.KEY);
    this.language = TranslationService.isLanguage(stored) ? stored : TranslationService.DEFAULT;
    this.root.lang = this.language;
  }

  private static isLanguage(value: string | null): value is Language {
    return value === "fr" || value === "en";
  }

  current(): Language {
    return this.language;
  }

  set(language: Language): void {
    this.language = language;
    this.store.set(TranslationService.KEY, language);
    this.root.lang = language;
  }

  /** The text of `key`, with each `{name}` replaced by `params.name`. */
  t(key: TranslationKey, params: Record<string, string | number> = {}): string {
    const text = this.dictionaries[this.language][key] ?? key;
    return text.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    );
  }
}

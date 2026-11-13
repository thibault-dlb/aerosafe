import type { Language } from "@/services/TranslationService";

/** Shows and reads the instants of the replay, which are always in UTC: the dataset is of 2022. */
export class ReplayTime {
  /** An instant for a person, in UTC and in the language of the interface. */
  static display(moment: Date, language: Language): string {
    return new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : "en-GB", {
      timeZone: "UTC",
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(moment);
  }

  /** An instant for the home page title: day and time, short. */
  static short(moment: Date, language: Language): string {
    return new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : "en-GB", {
      timeZone: "UTC",
      dateStyle: "short",
      timeStyle: "short",
    }).format(moment);
  }

  /** The value of an `<input type="datetime-local">`: `YYYY-MM-DDTHH:mm`, read as UTC. */
  static toInput(moment: Date): string {
    return moment.toISOString().slice(0, 16);
  }

  /** The instant an `<input type="datetime-local">` holds, read as UTC; null if it is empty. */
  static fromInput(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
      return null;
    }
    const moment = new Date(`${value}:00Z`);
    return Number.isNaN(moment.getTime()) ? null : moment;
  }
}

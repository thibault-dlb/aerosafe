import type { TranslationKey } from "@/i18n/fr";

/** The figures of the home page. Each comes from the project documentation (see docs/). */
export const FIGURES: { value: number; unit: string; label: TranslationKey }[] = [
  // Collection period of the Île-de-France profile (docs/architecture.md).
  { value: 30, unit: "s", label: "home.figures.period" },
  // Business rules R1 to R5 (docs/business-rules.md).
  { value: 5, unit: "", label: "home.figures.rules" },
  // Points of the year 2022 loaded over France and 100 km: 855 808 655 (docs/historical-data.md).
  { value: 856, unit: "M", label: "home.figures.points" },
  // The year 2022 can be replayed.
  { value: 365, unit: "", label: "home.figures.days" },
];

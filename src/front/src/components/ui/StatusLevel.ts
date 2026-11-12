export type StatusLevel = "normal" | "warning" | "danger";

/** Maps the criticality of an alert to the level a badge shows. */
export class StatusLevels {
  static fromCriticality(criticality: string | null | undefined): StatusLevel {
    switch (criticality) {
      case "HIGH":
        return "danger";
      case "MEDIUM":
        return "warning";
      default:
        return "normal";
    }
  }
}

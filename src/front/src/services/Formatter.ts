import type { UnitSystem } from "@/services/UnitService";
import { type Measure, Units } from "@/services/Units";

/** Display of measured values, dates and durations. A missing value shows as an en dash. */
export class Formatter {
  static readonly MISSING = "–";

  /** A number with its unit, with a fixed number of decimals. */
  static number(value: number | null, unit: string, digits = 0): string {
    return value === null ? Formatter.MISSING : `${value.toFixed(digits)} ${unit}`;
  }

  /** A number with its unit, rounded to one decimal without a trailing zero ("420 s"). */
  static rounded(value: number | null, unit: string): string {
    return value === null ? Formatter.MISSING : `${Number(value.toFixed(1))} ${unit}`;
  }

  /** An altitude given in metres, shown in the unit system chosen (metres by default). */
  static altitude(metres: number | null, system: UnitSystem = "metric", digits = 0): string {
    return Formatter.measure(metres, (value) => Units.altitude(value, system), digits);
  }

  /** A ground speed given in metres per second. */
  static speed(metresPerSecond: number | null, system: UnitSystem = "metric", digits = 0): string {
    return Formatter.measure(metresPerSecond, (value) => Units.speed(value, system), digits);
  }

  /** A distance given in kilometres. */
  static distance(kilometres: number | null, system: UnitSystem = "metric", digits = 1): string {
    return Formatter.measure(kilometres, (value) => Units.distance(value, system), digits);
  }

  /** A value of a rule given in the unit of the rule, rounded to one decimal. */
  static ruleValue(value: number | null, unit: string, system: UnitSystem = "metric"): string {
    if (value === null) return Formatter.MISSING;
    const measure = Units.ruleValue(value, unit, system);
    return Formatter.rounded(measure.value, measure.unit);
  }

  private static measure(value: number | null, convert: (value: number) => Measure, digits: number): string {
    if (value === null) return Formatter.MISSING;
    const measure = convert(value);
    return Formatter.number(measure.value, measure.unit, digits);
  }

  static date(value: Date | null): string {
    return value === null ? Formatter.MISSING : value.toLocaleString();
  }

  /** A duration such as "1 h 05 min" or "45 s". */
  static duration(seconds: number): string {
    const total = Math.round(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (hours > 0) return `${hours} h ${String(minutes).padStart(2, "0")} min`;
    if (minutes > 0) return `${minutes} min ${String(total % 60).padStart(2, "0")} s`;
    return `${total} s`;
  }
}

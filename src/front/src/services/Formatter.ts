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

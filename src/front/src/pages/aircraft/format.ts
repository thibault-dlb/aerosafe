/** Display helpers for flight parameters. A missing value shows as an en dash. */

const MISSING = "–";

export function formatNumber(value: number | null, unit: string, digits = 0): string {
  return value === null ? MISSING : `${value.toFixed(digits)} ${unit}`;
}

export function formatDate(value: Date | null): string {
  return value === null ? MISSING : value.toLocaleString();
}

/** A duration such as "1 h 05 min" or "45 s". */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, "0")} min`;
  if (minutes > 0) return `${minutes} min ${String(total % 60).padStart(2, "0")} s`;
  return `${total} s`;
}

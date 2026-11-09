import type { Alert } from "@/models/Alert";

export const MISSING = "–";

/** A value in the unit of its rule, rounded to one decimal; an en dash when missing. */
export function formatValue(value: number | null, unit: string): string {
  return value === null ? MISSING : `${Number(value.toFixed(1))} ${unit}`;
}

/** Where the alert stands for the Supervisor. */
export function statusLabel(alert: Alert): string {
  if (alert.processed) return "Processed";
  return alert.active ? "Active" : "Ended, not processed";
}

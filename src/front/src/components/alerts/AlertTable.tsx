import type { Alert } from "@/models/Alert";

import { Formatter } from "@/services/Formatter";

export interface AlertTableProps {
  alerts: Alert[];
  caption?: string;
  /** Called when the Supervisor opens the details of an alert. */
  onSelect?: (alert: Alert) => void;
  /** Called by the "Mark as processed" button; without it, the button is not shown. */
  onProcess?: (alert: Alert) => void;
  /** Identifier of the alert being processed, whose button is disabled. */
  processingId?: string | null;
}

/** Alerts as a table (BF-12). Contract used by the dashboard of the collection work package. */
export default function AlertTable({
  alerts,
  caption,
  onSelect,
  onProcess,
  processingId = null,
}: AlertTableProps) {
  return (
    <table>
      {caption && <caption>{caption}</caption>}
      <thead>
        <tr>
          <th scope="col">Rule</th>
          <th scope="col">Triggered at</th>
          <th scope="col">Aircraft</th>
          <th scope="col">Value</th>
          <th scope="col">Threshold</th>
          <th scope="col">Criticality</th>
          <th scope="col">Status</th>
          <th scope="col">Message</th>
          {(onSelect || onProcess) && <th scope="col">Actions</th>}
        </tr>
      </thead>
      <tbody>
        {alerts.map((alert) => (
          <tr key={alert.id}>
            <td>{alert.ruleCode}</td>
            <td>{alert.triggeredAt.toLocaleString()}</td>
            <td>{alert.aircraftName || Formatter.MISSING}</td>
            <td>{Formatter.rounded(alert.observedValue, alert.unit)}</td>
            <td>{Formatter.rounded(alert.threshold, alert.unit)}</td>
            <td>{alert.criticality ?? Formatter.MISSING}</td>
            <td>{alert.statusLabel}</td>
            <td>{alert.message}</td>
            {(onSelect || onProcess) && (
              <td>
                {onSelect && (
                  <button
                    type="button"
                    onClick={() => onSelect(alert)}
                    aria-label={`Details of ${alert.ruleCode} for ${alert.aircraftName}`}
                  >
                    Details
                  </button>
                )}
                {onProcess && !alert.processed && (
                  <button
                    type="button"
                    onClick={() => onProcess(alert)}
                    disabled={processingId === alert.id}
                    aria-label={`Mark ${alert.ruleCode} for ${alert.aircraftName} as processed`}
                  >
                    Mark as processed
                  </button>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

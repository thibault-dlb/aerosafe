import type { Alert } from "@/models/Alert";

export interface AlertTableProps {
  alerts: Alert[];
}

/** Contract used by the dashboard. The `feat/rules-alerts` work package completes it. */
export default function AlertTable({ alerts }: AlertTableProps) {
  return (
    <table>
      <tbody>
        {alerts.map((alert) => (
          <tr key={alert.id}>
            <td>{alert.ruleCode}</td>
            <td>{alert.triggeredAt}</td>
            <td>{alert.message}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

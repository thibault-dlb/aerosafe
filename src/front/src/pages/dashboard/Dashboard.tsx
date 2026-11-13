import LiveOverview from "@/components/overview/LiveOverview";
import type { LiveOverviewService } from "@/services/LiveOverviewService";

export interface DashboardProps {
  /** Where the live figures come from. Tests give their own. */
  overview?: LiveOverviewService;
}

/** Supervision dashboard: the live overview and the map come first, the rest of the page follows. */
export default function Dashboard({ overview }: DashboardProps) {
  return (
    <main>
      <h1>Dashboard</h1>
      <LiveOverview service={overview} large />
    </main>
  );
}

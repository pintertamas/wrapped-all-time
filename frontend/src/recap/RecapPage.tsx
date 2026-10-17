import type { RecapPeriod } from "../router";
import { routeToHash } from "../router";

const LABELS: Record<string, string> = {
  "4w": "Last 4 weeks",
  "6m": "Last 6 months",
  "12m": "Last 12 months",
  all: "All time",
};

export function periodLabel(period: RecapPeriod): string {
  return LABELS[period] ?? period;
}

// Shell only: the recap view arrives with the stats and recap tasks.
export default function RecapPage({ period }: { period: RecapPeriod }) {
  return (
    <main className="page" data-testid="recap">
      <h1>{periodLabel(period)}</h1>
      <p className="lead">No recap loaded yet.</p>
      <a className="btn btn-primary" href={routeToHash({ view: "import" })}>
        Load my data
      </a>
    </main>
  );
}

import type { RecapPeriod } from "../router";
import { routeToHash } from "../router";

const TABS: { period: RecapPeriod; label: string }[] = [
  { period: "4w", label: "4 weeks" },
  { period: "6m", label: "6 months" },
  { period: "12m", label: "12 months" },
  { period: "all", label: "All time" },
];

/** Period navigation. Links update the hash, so back/forward and sharing the URL just work. */
export default function PeriodTabs({ period }: { period: RecapPeriod }) {
  return (
    <nav aria-label="Period" className="tabs">
      {TABS.map((t) => (
        <a
          key={t.period}
          className="tab"
          href={routeToHash({ view: "recap", period: t.period })}
          aria-current={t.period === period ? "page" : undefined}
        >
          {t.label}
        </a>
      ))}
    </nav>
  );
}

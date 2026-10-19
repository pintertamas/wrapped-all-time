import type { RecapPeriod } from "../router";
import { routeToHash } from "../router";

export default function YearChips({
  years,
  period,
  extended,
  unlocked = true,
}: {
  years: string[];
  period: RecapPeriod;
  extended: boolean;
  unlocked?: boolean;
}) {
  if (!extended) {
    return (
      <p className="note" data-testid="years-need-extended">
        Calendar years need the Extended streaming history. Your Account data only covers about the last
        12 months. Request the Extended streaming history to see every year.
      </p>
    );
  }
  if (years.length === 0) return null;
  return (
    <nav aria-label="Years" className="chips">
      {years.map((y) =>
        unlocked ? (
        <a
          key={y}
          className="chip"
          href={routeToHash({ view: "recap", period: y as RecapPeriod })}
          aria-current={y === period ? "page" : undefined}
        >
          {y}
        </a>
        ) : (
          <a
            key={y}
            className="chip chip-locked"
            data-testid="chip-teaser"
            href={routeToHash({ view: "unlock", code: null })}
            aria-label={`${y}, locked. Unlock to see it`}
          >
            {y} (locked)
          </a>
        ),
      )}
    </nav>
  );
}

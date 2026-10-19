import type { RecapPeriod } from "../router";
import { routeToHash } from "../router";

export default function YearChips({
  years,
  period,
  extended,
}: {
  years: string[];
  period: RecapPeriod;
  extended: boolean;
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
      {years.map((y) => (
        <a
          key={y}
          className="chip"
          href={routeToHash({ view: "recap", period: y as RecapPeriod })}
          aria-current={y === period ? "page" : undefined}
        >
          {y}
        </a>
      ))}
    </nav>
  );
}

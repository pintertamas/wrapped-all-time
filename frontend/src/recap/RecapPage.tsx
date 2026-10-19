import { useState } from "react";
import type { PeriodStats, StatsBundle } from "../model/types";
import type { RecapPeriod } from "../router";
import { routeToHash } from "../router";
import { clearEverything } from "../storage/clear";
import { isUnlocked, loadPrefs, loadRecap, savePrefs } from "../storage/recap";
import PeriodTabs from "./PeriodTabs";
import StatTiles from "./StatTiles";
import TopList from "./TopList";
import ShareSheet from "../share/ShareSheet";
import YearChips from "./YearChips";

const LABELS: Record<string, string> = {
  "4w": "Last 4 weeks",
  "6m": "Last 6 months",
  "12m": "Last 12 months",
  all: "All time",
};

export function periodLabel(period: RecapPeriod): string {
  return LABELS[period] ?? period;
}

function statsFor(bundle: StatsBundle, period: RecapPeriod): PeriodStats | null {
  if (period === "4w" || period === "6m" || period === "12m") return bundle.periods[period];
  if (period === "all") return bundle.allTime;
  return bundle.years[period] ?? null;
}

const isFree = (p: RecapPeriod) => p === "4w" || p === "6m" || p === "12m";

function Periods({ stats }: { stats: PeriodStats }) {
  return (
    <>
      <p className="note">
        {stats.from} to {stats.to}
      </p>
      <StatTiles stats={stats} />
      <TopList
        title="Top artists"
        items={stats.topArtists.slice(0, 10).map((a) => ({
          key: a.name, primary: a.name, minutes: a.minutes, plays: a.plays,
        }))}
      />
      <TopList
        title="Top tracks"
        items={stats.topTracks.slice(0, 10).map((t) => ({
          key: `${t.artist}|${t.name}`, primary: t.name, secondary: t.artist, minutes: t.minutes, plays: t.plays,
        }))}
      />
      {stats.topAlbums ? (
        <TopList
          title="Top albums"
          items={stats.topAlbums.slice(0, 10).map((a) => ({
            key: `${a.artist}|${a.name}`, primary: a.name, secondary: a.artist, minutes: a.minutes, plays: a.plays,
          }))}
        />
      ) : (
        <p className="note">Top albums need the Extended streaming history.</p>
      )}
    </>
  );
}

function Locked({ period }: { period: RecapPeriod }) {
  return (
    <section className="card" data-testid="locked">
      <h2>{period === "all" ? "All time" : period} is part of the full unlock</h2>
      <p className="note">Numbers: ••• minutes, ••• plays. Unlock once for $4.99 to see every year and all time.</p>
      <a className="btn btn-primary" href={routeToHash({ view: "unlock", code: null })}>
        Unlock
      </a>
    </section>
  );
}

export default function RecapPage({ period }: { period: RecapPeriod }) {
  const [bundle] = useState<StatsBundle | null>(() => loadRecap());
  const [keep, setKeep] = useState(() => loadPrefs().keepRecap);
  const [sharing, setSharing] = useState(false);

  const heading = <h1>{periodLabel(period)}</h1>;

  if (!bundle) {
    return (
      <main className="page" data-testid="recap">
        {heading}
        <p className="lead">No recap loaded yet.</p>
        <a className="btn btn-primary" href={routeToHash({ view: "import" })}>
          Load my data
        </a>
      </main>
    );
  }

  const unlocked = bundle.sample || isUnlocked();
  const extended = bundle.sources.includes("extended");
  const years = Object.keys(bundle.years).sort().reverse();
  const stats = statsFor(bundle, period);

  let body;
  if (!isFree(period) && !unlocked) body = <Locked period={period} />;
  else if (!stats) {
    body = (
      <p className="note" data-testid="no-data">
        {extended ? `No plays found for ${periodLabel(period)}.` : "Years need the Extended streaming history."}
      </p>
    );
  } else {
    body = (
      <>
        <Periods stats={stats} />
        <button type="button" className="btn btn-primary" onClick={() => setSharing(true)}>
          Share
        </button>
        {sharing && (
          <ShareSheet
            stats={stats} period={period} periodLabel={periodLabel(period)}
            sample={bundle.sample} paid={isUnlocked()} onClose={() => setSharing(false)}
          />
        )}
      </>
    );
  }

  return (
    <main className="page" data-testid="recap">
      {bundle.sample && (
        <p className="sample-label" data-testid="sample-label">
          SAMPLE DATA
        </p>
      )}
      {heading}
      <PeriodTabs period={period} />
      <YearChips years={years} period={period} extended={extended} />
      {body}
      <section className="card" aria-label="Your data">
        <label>
          <input
            type="checkbox"
            checked={keep}
            onChange={(e) => {
              setKeep(e.target.checked);
              savePrefs({ v: 1, keepRecap: e.target.checked });
            }}
          />{" "}
          Keep my recap on this device
        </label>
        <p className="note">Off: the recap is forgotten when you close this tab.</p>
        <button type="button" className="btn" onClick={clearEverything}>
          Clear everything
        </button>
      </section>
    </main>
  );
}

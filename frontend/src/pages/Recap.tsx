import { useState } from "react";
import RangeTabs from "../components/RangeTabs";
import TopList from "../components/TopList";
import { sampleProfile, type TimeRange } from "../data/sampleProfile";
import { recap } from "../lib/recap";

const HEADLINES: Record<TimeRange, string> = {
  short_term: "Your last 4 weeks",
  medium_term: "Your last 6 months",
  long_term: "Your last year",
};

export default function Recap({ onLogout }: { onLogout: () => void }) {
  const [range, setRange] = useState<TimeRange>("long_term");
  const r = recap(sampleProfile, range);
  const max = Math.max(1, ...r.hourHistogram);
  return (
    <main className="page" data-testid="recap">
      <h1>{HEADLINES[range]}</h1>
      <RangeTabs value={range} onChange={setRange} />
      <TopList title="Top artists" items={r.topArtists.map((a) => ({ key: a.id, primary: a.name }))} />
      <TopList
        title="Top tracks"
        items={r.topTracks.map((t) => ({ key: t.id, primary: t.name, secondary: t.artists.map((a) => a.name).join(", ") }))}
      />
      <TopList title="Genres" items={r.topGenres.map((g) => ({ key: g.genre, primary: g.genre }))} />
      <section className="card">
        <h2>When you listen</h2>
        <div className="hist" role="img" aria-label="Plays by hour of day (UTC)">
          {r.hourHistogram.map((n, h) => (
            <span key={h} className="bar" style={{ height: `${(n / max) * 100}%` }} title={`${h}:00 - ${n}`} />
          ))}
        </div>
        <p className="note">Hour of day (UTC), from recent plays</p>
      </section>
      <button type="button" className="btn" onClick={onLogout}>
        Log out
      </button>
    </main>
  );
}

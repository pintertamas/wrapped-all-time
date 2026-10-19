import type { PeriodStats } from "../model/types";

const n = (v: number) => v.toLocaleString("en-US");

interface Tile { label: string; value: string; note?: string }

export function tilesFor(s: PeriodStats): Tile[] {
  const tiles: Tile[] = [
    { label: "Minutes listened", value: n(s.minutes), note: `about ${n(Math.round(s.minutes / 60))} hours of music` },
    { label: "Plays", value: n(s.plays) },
    { label: "Active days", value: n(s.activeDays) },
    { label: "Longest streak", value: `${n(s.longestStreakDays)} ${s.longestStreakDays === 1 ? "day" : "days"}` },
  ];
  if (s.topDay) tiles.push({ label: "Top day", value: s.topDay.date, note: `${n(s.topDay.minutes)} minutes` });
  if (s.podcastMinutes > 0) tiles.push({ label: "Podcast minutes", value: n(s.podcastMinutes) });
  if (s.skipRate !== null) tiles.push({ label: "Skip rate", value: `${Math.round(s.skipRate * 100)}%` });
  if (s.firstTrack) {
    tiles.push({ label: "First track", value: s.firstTrack.track, note: `${s.firstTrack.artist}, ${s.firstTrack.date}` });
  }
  return tiles;
}

export function busiestHour(hourMinutes: number[]): number | null {
  let best = -1;
  let bestMinutes = 0;
  hourMinutes.forEach((m, h) => {
    if (m > bestMinutes) {
      best = h;
      bestMinutes = m;
    }
  });
  return best < 0 ? null : best;
}

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

export default function StatTiles({ stats }: { stats: PeriodStats }) {
  const hour = busiestHour(stats.hourMinutes);
  const max = Math.max(1, ...stats.hourMinutes);
  return (
    <>
      <dl className="tiles">
        {tilesFor(stats).map((t) => (
          <div className="tile" key={t.label}>
            <dt>{t.label}</dt>
            <dd>{t.value}</dd>
            {t.note && <dd className="note">{t.note}</dd>}
          </div>
        ))}
      </dl>
      <section className="card" aria-label="Listening by hour">
        <h2>When you listen</h2>
        <div className="hours" aria-hidden="true">
          {stats.hourMinutes.map((m, h) => (
            <span key={h} style={{ height: `${Math.round((m / max) * 100)}%` }} />
          ))}
        </div>
        <p className="note" data-testid="hours-text">
          {hour === null
            ? "No listening time recorded for any hour."
            : `Most of your listening is around ${hh(hour)} (${n(Math.round(stats.hourMinutes[hour]))} minutes). Minutes per hour: ${stats.hourMinutes
                .map((m, h) => `${hh(h)} ${n(Math.round(m))}`)
                .join(", ")}.`}
        </p>
      </section>
    </>
  );
}

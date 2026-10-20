import { useEffect, useState } from "react";
import type { PeriodStats } from "../model/types";

const n = (v: number) => v.toLocaleString("en-US");

/** Numeric tiles count up from 0 to `to`; `value` stays the final text for tests and no-motion. */
interface Tile { label: string; value: string; note?: string; count?: { to: number; format: (v: number) => string } }

const COUNT_UP_MS = 900;

/** Animate only when the user has not asked for reduced motion (and matchMedia exists). */
export function allowCountUp(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
  } catch {
    return false;
  }
}

export function CountUp({ to, format }: { to: number; format: (v: number) => string }) {
  const [shown, setShown] = useState(() => (allowCountUp() ? 0 : to));
  useEffect(() => {
    if (!allowCountUp() || typeof requestAnimationFrame !== "function") return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_UP_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(t >= 1 ? to : Math.round(to * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to]);
  // Without motion the final value is shown at once, even when `to` changes between renders.
  return <>{format(allowCountUp() ? shown : to)}</>;
}

export function tilesFor(s: PeriodStats): Tile[] {
  const tiles: Tile[] = [
    { label: "Minutes listened", value: n(s.minutes), note: `about ${n(Math.round(s.minutes / 60))} hours of music`, count: { to: s.minutes, format: n } },
    { label: "Plays", value: n(s.plays), count: { to: s.plays, format: n } },
    { label: "Active days", value: n(s.activeDays), count: { to: s.activeDays, format: n } },
    {
      label: "Longest streak",
      value: `${n(s.longestStreakDays)} ${s.longestStreakDays === 1 ? "day" : "days"}`,
      count: { to: s.longestStreakDays, format: (v) => `${n(v)} ${s.longestStreakDays === 1 ? "day" : "days"}` },
    },
  ];
  if (s.topDay) tiles.push({ label: "Top day", value: s.topDay.date, note: `${n(s.topDay.minutes)} minutes` });
  if (s.podcastMinutes > 0) tiles.push({ label: "Podcast minutes", value: n(s.podcastMinutes), count: { to: s.podcastMinutes, format: n } });
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
            <dd>{t.count ? <CountUp to={t.count.to} format={t.count.format} /> : t.value}</dd>
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

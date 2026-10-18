// Stats engine part 1: periods, years, all time, tops, minutes and plays.
// Pure over a PlayStore; runs in the worker. Part 2 (days.ts) fills the day-based fields.
import type { ExportKind, PeriodStats, StatsBundle } from "../model/types";
import type { PlayStore } from "../import/store";
import { dayNumberFromIso, isoFromDayNumber, LocalClock, rollingRanges, yearRange, type DayRange } from "./periods";
import { PLAY_THRESHOLD_MS, toMinutes, TopAccumulator } from "./tops";

export interface ComputeOptions {
  tz: string;
  sources: ExportKind[];
  sample?: boolean;
}

class Bucket {
  musicMs = 0;
  plays = 0;
  podcastMs = 0;
  artists = new TopAccumulator();
  tracks = new TopAccumulator();
  albums = new TopAccumulator();
  constructor(readonly from: number, readonly to: number) {}

  toStats(withAlbums: boolean): PeriodStats {
    return {
      from: isoFromDayNumber(this.from), to: isoFromDayNumber(this.to),
      minutes: toMinutes(this.musicMs), plays: this.plays, podcastMinutes: toMinutes(this.podcastMs),
      topArtists: this.artists.artists(), topTracks: this.tracks.withArtist(),
      topAlbums: withAlbums ? this.albums.withArtist() : null,
      topDay: null, longestStreakDays: 0, activeDays: 0, firstTrack: null, skipRate: null,
      hourMinutes: new Array<number>(24).fill(0),
    };
  }
}

export function computeStats(store: PlayStore, opts: ComputeOptions): StatsBundle {
  const { tz, sources } = opts;
  const clock = new LocalClock(tz);
  const range = store.range();
  const withAlbums = sources.includes("extended");

  if (range === null) {
    const today = isoFromDayNumber(clock.dayNumber(Date.now()));
    const d = dayNumberFromIso(today);
    const r = rollingRanges(d);
    const empty = (x: DayRange) => new Bucket(x.from, x.to).toStats(false);
    return {
      version: 1, tz, sources, sample: opts.sample ?? false, latestPlay: today,
      periods: { "4w": empty(r["4w"]), "6m": empty(r["6m"]), "12m": empty(r["12m"]) },
      years: {}, allTime: new Bucket(d, d).toStats(false),
    };
  }

  const firstDay = clock.dayNumber(range.min);
  const latestDay = clock.dayNumber(range.max);
  const rolling = rollingRanges(latestDay);
  const periods = {
    "4w": new Bucket(rolling["4w"].from, latestDay),
    "6m": new Bucket(rolling["6m"].from, latestDay),
    "12m": new Bucket(rolling["12m"].from, latestDay),
  };
  const allTime = new Bucket(firstDay, latestDay);
  const years = new Map<number, Bucket>();

  for (let i = 0; i < store.length; i++) {
    const ms = store.msPlayed(i);
    const p = store.at(i);
    const t = p.endMs;
    const day = clock.dayNumber(t);
    const year = clock.year(t);
    let yb = years.get(year);
    if (yb === undefined) {
      const yr = yearRange(year);
      yb = new Bucket(yr.from, yr.to);
      years.set(year, yb);
    }
    const hit: Bucket[] = [allTime, yb];
    if (day >= rolling["4w"].from) hit.push(periods["4w"]);
    if (day >= rolling["6m"].from) hit.push(periods["6m"]);
    if (day >= rolling["12m"].from) hit.push(periods["12m"]);

    if (p.kind === "podcast") {
      for (const b of hit) b.podcastMs += ms;
      continue;
    }
    const counted = ms >= PLAY_THRESHOLD_MS;
    const trackKey = `${p.artist}\u0000${p.track}`;
    const albumKey = p.album === null ? null : `${p.artist}\u0000${p.album}`;
    for (const b of hit) {
      b.musicMs += ms;
      if (counted) b.plays++;
      b.artists.add(p.artist, p.artist, p.artist, ms, counted);
      b.tracks.add(trackKey, p.track, p.artist, ms, counted);
      if (albumKey !== null && p.album !== null) b.albums.add(albumKey, p.album, p.artist, ms, counted);
    }
  }

  const yearStats: Record<string, PeriodStats> = {};
  for (const y of [...years.keys()].sort((a, b) => a - b)) yearStats[String(y)] = years.get(y)!.toStats(withAlbums);

  return {
    version: 1, tz, sources, sample: opts.sample ?? false, latestPlay: isoFromDayNumber(latestDay),
    periods: { "4w": periods["4w"].toStats(withAlbums), "6m": periods["6m"].toStats(withAlbums), "12m": periods["12m"].toStats(withAlbums) },
    years: yearStats,
    allTime: allTime.toStats(withAlbums),
  };
}

import type { Ranked, RankedWithArtist } from "../model/types";

export const TOP_N = 50;
/** A music row counts as a play from this many milliseconds on. */
export const PLAY_THRESHOLD_MS = 30_000;

interface Acc { name: string; artist: string; ms: number; plays: number }

/** Accumulates listening time and plays per key; ranks them at the end. */
export class TopAccumulator {
  private map = new Map<string, Acc>();

  add(key: string, name: string, artist: string, ms: number, counted: boolean): void {
    let a = this.map.get(key);
    if (a === undefined) {
      a = { name, artist, ms: 0, plays: 0 };
      this.map.set(key, a);
    }
    a.ms += ms;
    if (counted) a.plays++;
  }

  private ranked(limit: number): Acc[] {
    return [...this.map.values()]
      .sort((x, y) => y.ms - x.ms || y.plays - x.plays || x.name.localeCompare(y.name) || x.artist.localeCompare(y.artist))
      .slice(0, limit);
  }

  artists(limit = TOP_N): Ranked[] {
    return this.ranked(limit).map((a) => ({ name: a.name, minutes: toMinutes(a.ms), plays: a.plays }));
  }

  withArtist(limit = TOP_N): RankedWithArtist[] {
    return this.ranked(limit).map((a) => ({ name: a.name, artist: a.artist, minutes: toMinutes(a.ms), plays: a.plays }));
  }
}

export function toMinutes(ms: number): number {
  return Math.round(ms / 60_000);
}

// Stats engine part 2: day-based fields (top day, streaks, active days, hours, first track, skip rate).
import type { PeriodStats } from "../model/types";
import { isoFromDayNumber } from "./periods";
import { toMinutes } from "./tops";

type DayFields = Pick<PeriodStats, "topDay" | "longestStreakDays" | "activeDays" | "firstTrack" | "skipRate" | "hourMinutes">;

/** Collects the day-based fields of one period. Music rows only. */
export class DayAccumulator {
  private dayMs = new Map<number, number>();
  private active = new Set<number>();
  private hourMs = new Array<number>(24).fill(0);
  private first: { endMs: number; track: string; artist: string; day: number } | null = null;
  private extendedRows = 0;
  private skipped = 0;

  /** counted = msPlayed >= 30 s; only counted plays make a day active. */
  add(day: number, hour: number, ms: number, counted: boolean): void {
    this.dayMs.set(day, (this.dayMs.get(day) ?? 0) + ms);
    this.hourMs[hour] = this.hourMs[hour]! + ms;
    if (counted) this.active.add(day);
  }

  /** Extended rows only: feeds first track and skip rate. */
  addExtended(endMs: number, day: number, track: string, artist: string, skipped: boolean | null): void {
    if (this.first === null || endMs < this.first.endMs) this.first = { endMs, track, artist, day };
    this.extendedRows++;
    if (skipped === true) this.skipped++;
  }

  result(withExtended: boolean): DayFields {
    let top: { day: number; ms: number } | null = null;
    for (const [day, ms] of this.dayMs) {
      if (top === null || ms > top.ms || (ms === top.ms && day < top.day)) top = { day, ms };
    }
    const days = [...this.active].sort((a, b) => a - b);
    let longest = 0;
    let run = 0;
    for (let i = 0; i < days.length; i++) {
      run = i > 0 && days[i] === days[i - 1]! + 1 ? run + 1 : 1;
      if (run > longest) longest = run;
    }
    const hasExt = withExtended && this.extendedRows > 0;
    return {
      topDay: top === null ? null : { date: isoFromDayNumber(top.day), minutes: toMinutes(top.ms) },
      longestStreakDays: longest,
      activeDays: days.length,
      firstTrack: hasExt && this.first !== null
        ? { track: this.first.track, artist: this.first.artist, date: isoFromDayNumber(this.first.day) } : null,
      skipRate: hasExt ? this.skipped / this.extendedRows : null,
      hourMinutes: this.hourMs.map(toMinutes),
    };
  }
}

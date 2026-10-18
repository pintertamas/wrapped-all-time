// Calendar and rolling-period maths in the user's IANA time zone. Pure functions.

const DAY_MS = 86_400_000;
const BUCKET_MS = 15 * 60_000; // UTC offsets only change on 15-minute boundaries

const fmtCache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

/** Offset (local minus UTC, in ms) of the zone at an instant. */
function offsetAt(ms: number, tz: string): number {
  const parts = formatter(tz).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const local = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return local - Math.floor(ms / 1000) * 1000;
}

/** Converts instants to local time; caches the zone offset per 15-minute bucket. */
export class LocalClock {
  private cache = new Map<number, number>();
  constructor(readonly tz: string) {}

  offset(ms: number): number {
    const key = Math.floor(ms / BUCKET_MS);
    let o = this.cache.get(key);
    if (o === undefined) {
      o = offsetAt(key * BUCKET_MS, this.tz);
      this.cache.set(key, o);
    }
    return o;
  }

  /** Local wall-clock time as a UTC-based epoch value. */
  local(ms: number): number {
    return ms + this.offset(ms);
  }

  /** Local day number (days since 1970-01-01 of the local calendar date). */
  dayNumber(ms: number): number {
    return Math.floor(this.local(ms) / DAY_MS);
  }

  /** Local hour of day, 0..23. */
  hour(ms: number): number {
    return Math.floor((this.local(ms) % DAY_MS) / 3_600_000);
  }

  /** Local calendar year. */
  year(ms: number): number {
    return new Date(this.local(ms)).getUTCFullYear();
  }
}

export function isoFromDayNumber(day: number): string {
  const d = new Date(day * DAY_MS);
  const y = d.getUTCFullYear();
  return `${String(y).padStart(4, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function dayNumberFromIso(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y!, m! - 1, d!) / DAY_MS);
}

/** Day number minus whole calendar months, clamping the day of month (31 Aug - 6 months = 28/29 Feb). */
export function minusMonths(day: number, months: number): number {
  const d = new Date(day * DAY_MS);
  const total = d.getUTCFullYear() * 12 + d.getUTCMonth() - months;
  const y = Math.floor(total / 12);
  const m = total - y * 12;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return Math.floor(Date.UTC(y, m, Math.min(d.getUTCDate(), last)) / DAY_MS);
}

export interface DayRange { key: string; from: number; to: number }

/**
 * Rolling free periods measured back from the latest play's local date, both ends inclusive:
 * 4w = 28 days; 6m / 12m = the same date 6 / 12 months earlier, plus one day.
 */
export function rollingRanges(latestDay: number): { "4w": DayRange; "6m": DayRange; "12m": DayRange } {
  return {
    "4w": { key: "4w", from: latestDay - 27, to: latestDay },
    "6m": { key: "6m", from: minusMonths(latestDay, 6) + 1, to: latestDay },
    "12m": { key: "12m", from: minusMonths(latestDay, 12) + 1, to: latestDay },
  };
}

/** Whole calendar year (Jan 1 .. Dec 31) as a day range. */
export function yearRange(year: number): DayRange {
  return {
    key: String(year),
    from: Math.floor(Date.UTC(year, 0, 1) / DAY_MS),
    to: Math.floor(Date.UTC(year, 11, 31) / DAY_MS),
  };
}

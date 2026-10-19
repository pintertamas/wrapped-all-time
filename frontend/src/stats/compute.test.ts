import { describe, expect, it } from "vitest";
import type { Play } from "../model/types";
import { PlayStore } from "../import/store";
import { adaptExtendedAudio } from "../import/adapters/extended";
import { generate } from "../sample/generate";
import { computeStats } from "./compute";
import { LocalClock, minusMonths, dayNumberFromIso, isoFromDayNumber, rollingRanges } from "./periods";
import { TopAccumulator } from "./tops";

const play = (iso: string, over: Partial<Play> = {}): Play => ({
  endMs: Date.parse(iso), msPlayed: 180_000, kind: "music", artist: "A", track: "T", album: null,
  skipped: null, source: "extended", ...over,
});
const store = (plays: Play[]): PlayStore => {
  const s = new PlayStore();
  plays.forEach((p) => s.push(p));
  return s;
};
const opts = (tz: string, sources: ("account" | "extended")[] = ["extended"]) => ({ tz, sources });

describe("calendar years in the user's time zone", () => {
  const plays = [play("2023-12-31T23:30:00Z"), play("2023-12-31T12:00:00Z")];
  it("counts 23:30 UTC on 31 Dec in the next year for Europe/Budapest", () => {
    const b = computeStats(store(plays), opts("Europe/Budapest"));
    expect(Object.keys(b.years)).toEqual(["2023", "2024"]);
    expect(b.years["2024"]!.plays).toBe(1);
    expect(b.years["2023"]!.plays).toBe(1);
    expect(b.latestPlay).toBe("2024-01-01");
  });
  it("keeps it in the same year for UTC", () => {
    const b = computeStats(store(plays), opts("UTC"));
    expect(Object.keys(b.years)).toEqual(["2023"]);
    expect(b.years["2023"]!.plays).toBe(2);
    expect(b.years["2023"]).toMatchObject({ from: "2023-01-01", to: "2023-12-31" });
  });
  it("lists only years with data", () => {
    const b = computeStats(store([play("2019-05-01T10:00:00Z"), play("2022-05-01T10:00:00Z")]), opts("UTC"));
    expect(Object.keys(b.years)).toEqual(["2019", "2022"]);
  });
});

describe("rolling periods", () => {
  it("measures 4w / 6m / 12m back from the latest play, inclusive", () => {
    const b = computeStats(store([
      play("2024-06-30T10:00:00Z", { track: "latest" }),
      play("2024-06-03T10:00:00Z"), // 28th day back: inside 4w
      play("2024-06-02T10:00:00Z"), // outside 4w
      play("2023-12-31T10:00:00Z"), // inside 6m (from 2023-12-31)
      play("2023-12-30T10:00:00Z"), // outside 6m, inside 12m
      play("2023-07-01T10:00:00Z"), // inside 12m (from 2023-07-01)
      play("2023-06-30T10:00:00Z"), // outside 12m
    ]), opts("UTC"));
    expect(b.latestPlay).toBe("2024-06-30");
    expect(b.periods["4w"]).toMatchObject({ from: "2024-06-03", to: "2024-06-30", plays: 2 });
    expect(b.periods["6m"]).toMatchObject({ from: "2023-12-31", to: "2024-06-30", plays: 4 });
    expect(b.periods["12m"]).toMatchObject({ from: "2023-07-01", to: "2024-06-30", plays: 6 });
    expect(b.allTime).toMatchObject({ from: "2023-06-30", to: "2024-06-30", plays: 7 });
  });
  it("clamps month ends", () => {
    expect(isoFromDayNumber(minusMonths(dayNumberFromIso("2023-08-31"), 6))).toBe("2023-02-28");
    expect(isoFromDayNumber(rollingRanges(dayNumberFromIso("2024-02-29"))["12m"].from)).toBe("2023-03-01");
  });
});

describe("minutes and plays", () => {
  it("minutes are music only and rounded; plays need msPlayed >= 30000; podcasts are separate", () => {
    const b = computeStats(store([
      play("2024-03-01T10:00:00Z", { msPlayed: 29_999 }),
      play("2024-03-01T10:10:00Z", { msPlayed: 30_000 }),
      play("2024-03-01T10:20:00Z", { msPlayed: 90_000 }),
      play("2024-03-01T11:00:00Z", { kind: "podcast", artist: "Show", track: "Ep", msPlayed: 600_000 }),
    ]), opts("UTC"));
    // 29.999 + 30 + 90 s = 149.999 s = 2.4999 min -> 2
    expect(b.allTime.minutes).toBe(2);
    expect(b.allTime.plays).toBe(2);
    expect(b.allTime.podcastMinutes).toBe(10);
    expect(b.allTime.topArtists.map((a) => a.name)).toEqual(["A"]);
  });
});

describe("tops", () => {
  it("ranks by minutes then plays, caps at 50, ties are stable", () => {
    const acc = new TopAccumulator();
    acc.add("a", "a", "x", 120_000, true); // 2 min, 1 play
    acc.add("b", "b", "x", 60_000, true);
    acc.add("b", "b", "x", 60_000, true); // 2 min, 2 plays
    acc.add("c", "c", "x", 60_000, true);
    expect(acc.artists().map((r) => r.name)).toEqual(["b", "a", "c"]);
    const many = new TopAccumulator();
    for (let i = 0; i < 80; i++) many.add(`k${i}`, `n${i}`, "x", 60_000 + i, true);
    expect(many.artists()).toHaveLength(50);
  });
  it("tracks and albums carry their artist; same title by different artists stays apart", () => {
    const b = computeStats(store([
      play("2024-03-01T10:00:00Z", { artist: "A", track: "Same", album: "Al" }),
      play("2024-03-01T10:05:00Z", { artist: "B", track: "Same", album: "Al" }),
    ]), opts("UTC"));
    expect(b.allTime.topTracks.map((t) => t.artist).sort()).toEqual(["A", "B"]);
    expect(b.allTime.topAlbums).toHaveLength(2);
  });
  it("topAlbums is null without Extended data", () => {
    const b = computeStats(store([play("2024-03-01T10:00:00Z", { source: "account" })]), opts("UTC", ["account"]));
    expect(b.allTime.topAlbums).toBeNull();
    expect(b.periods["4w"].topAlbums).toBeNull();
  });
});

describe("LocalClock", () => {
  it("handles the DST change", () => {
    const c = new LocalClock("Europe/Budapest");
    expect(isoFromDayNumber(c.dayNumber(Date.parse("2024-03-30T23:30:00Z")))).toBe("2024-03-31");
    expect(c.hour(Date.parse("2024-03-31T00:30:00Z"))).toBe(1);
    expect(c.hour(Date.parse("2024-03-31T01:30:00Z"))).toBe(3);
  });
});

describe("sample data (F3)", () => {
  it("produces a full bundle for the seeded history", () => {
    const s = new PlayStore();
    for (const p of adaptExtendedAudio(generate(1)).plays) s.push(p);
    const b = computeStats(s, { tz: "Europe/Budapest", sources: ["extended"], sample: true });
    expect(b.version).toBe(1);
    expect(b.sample).toBe(true);
    expect(Object.keys(b.years).length).toBeGreaterThanOrEqual(6);
    expect(b.allTime.topArtists.length).toBeLessThanOrEqual(50);
    expect(b.allTime.topArtists.length).toBeGreaterThan(0);
    expect(b.allTime.topAlbums).not.toBeNull();
    expect(b.periods["4w"].minutes).toBeLessThan(b.periods["12m"].minutes);
    expect(b.periods["12m"].minutes).toBeLessThan(b.allTime.minutes);
    const yearSum = Object.values(b.years).reduce((n, y) => n + y.plays, 0);
    expect(yearSum).toBe(b.allTime.plays);
    expect(b.allTime.topArtists[0]!.minutes).toBeGreaterThanOrEqual(b.allTime.topArtists[1]!.minutes);
    for (const p of Object.values(b.periods)) expect(p.hourMinutes).toHaveLength(24);
  });
});

describe("day-based fields", () => {
  it("handles the Europe/Budapest DST change day (23 h) for day and hour", () => {
    // 2024-03-31: clocks jump 02:00 -> 03:00 (UTC+1 -> UTC+2)
    const b = computeStats(store([
      play("2024-03-30T23:30:00Z", { msPlayed: 60_000 }), // local 31 Mar 00:30
      play("2024-03-31T00:30:00Z", { msPlayed: 120_000 }), // local 01:30
      play("2024-03-31T01:30:00Z", { msPlayed: 180_000 }), // local 03:30
      play("2024-03-31T22:30:00Z", { msPlayed: 60_000 }), // local 1 Apr 00:30
    ]), opts("Europe/Budapest"));
    const a = b.allTime;
    expect(a.topDay).toEqual({ date: "2024-03-31", minutes: 6 });
    expect(a.activeDays).toBe(2);
    expect(a.longestStreakDays).toBe(2);
    expect(a.hourMinutes).toHaveLength(24);
    expect(a.hourMinutes[0]).toBe(2);
    expect(a.hourMinutes[1]).toBe(2);
    expect(a.hourMinutes[2]).toBe(0);
    expect(a.hourMinutes[3]).toBe(3);
  });
  it("counts a streak across a year boundary and fills every period", () => {
    const b = computeStats(store([
      play("2023-12-30T12:00:00Z"), play("2023-12-31T12:00:00Z"),
      play("2024-01-01T12:00:00Z"), play("2024-01-03T12:00:00Z"),
    ]), opts("UTC"));
    expect(b.allTime.longestStreakDays).toBe(3);
    expect(b.allTime.activeDays).toBe(4);
    expect(b.years["2023"]!.longestStreakDays).toBe(2);
    expect(b.years["2024"]!.longestStreakDays).toBe(1);
    for (const p of [...Object.values(b.periods), ...Object.values(b.years)]) {
      expect(p.hourMinutes).toHaveLength(24);
      expect(p.topDay).not.toBeNull();
    }
  });
  it("needs a 30 s play to make a day active", () => {
    const b = computeStats(store([
      play("2024-05-01T10:00:00Z", { msPlayed: 29_999 }),
      play("2024-05-02T10:00:00Z", { msPlayed: 30_000 }),
      play("2024-05-03T10:00:00Z", { msPlayed: 29_999 }),
    ]), opts("UTC"));
    expect(b.allTime.activeDays).toBe(1);
    expect(b.allTime.longestStreakDays).toBe(1);
  });
  it("sets firstTrack and skipRate only with Extended data", () => {
    const ext = computeStats(store([
      play("2024-05-02T10:00:00Z", { track: "second", skipped: true }),
      play("2024-05-01T10:00:00Z", { track: "first", artist: "X", skipped: false }),
      play("2024-05-03T10:00:00Z", { skipped: null }),
      play("2024-05-04T10:00:00Z", { skipped: false }),
    ]), opts("UTC"));
    expect(ext.allTime.firstTrack).toEqual({ track: "first", artist: "X", date: "2024-05-01" });
    expect(ext.allTime.skipRate).toBe(0.25);
    const acc = computeStats(store([play("2024-05-01T10:00:00Z", { source: "account" })]), opts("UTC", ["account"]));
    expect(acc.allTime.firstTrack).toBeNull();
    expect(acc.allTime.skipRate).toBeNull();
    expect(acc.allTime.topDay).not.toBeNull();
  });
});

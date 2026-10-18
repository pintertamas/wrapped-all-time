import { describe, expect, it } from "vitest";
import type { Play } from "../model/types";
import { dropAccountOverlap, FileDeduper, PlayDeduper } from "./dedupe";
import { PlayStore } from "./store";

function play(over: Partial<Play> = {}): Play {
  return {
    endMs: Date.UTC(2022, 0, 1, 12), msPlayed: 60000, kind: "music", artist: "A", track: "T",
    album: null, skipped: null, source: "account", ...over,
  };
}

describe("rule 1: same name and size file is skipped", () => {
  it("skips a repeat of the same base name and byte size, whatever the folder", () => {
    const d = new FileDeduper();
    expect(d.check("a/StreamingHistory_music_0.json", 100)).toBeNull();
    expect(d.check("b/StreamingHistory_music_0.json", 100)).toBe("a/StreamingHistory_music_0.json");
  });
  it("keeps files that differ in name or size", () => {
    const d = new FileDeduper();
    expect(d.check("x.json", 100)).toBeNull();
    expect(d.check("x.json", 101)).toBeNull();
    expect(d.check("y.json", 100)).toBeNull();
  });
});

describe("rule 2: in-source duplicate plays are dropped", () => {
  it("drops plays with equal endMs, msPlayed, artist and track within a source", () => {
    const store = new PlayStore();
    const d = new PlayDeduper(store);
    expect(d.add(play())).toBe(true);
    expect(d.add(play())).toBe(false);
    expect(d.add(play({ msPlayed: 60001 }))).toBe(true);
    expect(d.add(play({ track: "T2" }))).toBe(true);
    expect(d.add(play({ artist: "B" }))).toBe(true);
    expect(d.add(play({ endMs: Date.UTC(2022, 0, 1, 12, 1) }))).toBe(true);
    expect(store.length).toBe(5);
  });
  it("compares per source, so the same play in Account and Extended both stay", () => {
    const store = new PlayStore();
    const d = new PlayDeduper(store);
    expect(d.add(play({ source: "account" }))).toBe(true);
    expect(d.add(play({ source: "extended" }))).toBe(true);
    expect(store.length).toBe(2);
  });
  it("stays exact across table growth", () => {
    const store = new PlayStore(16);
    const d = new PlayDeduper(store);
    let added = 0;
    for (let i = 0; i < 5000; i++) if (d.add(play({ endMs: 1_600_000_000_000 + i * 1000, track: `t${i % 50}` }))) added++;
    for (let i = 0; i < 5000; i++) if (d.add(play({ endMs: 1_600_000_000_000 + i * 1000, track: `t${i % 50}` }))) added++;
    expect(added).toBe(5000);
    expect(store.length).toBe(5000);
  });
});

describe("rule 3: Account plays inside the Extended range are dropped", () => {
  it("drops only Account plays within [min, max] of Extended and returns the count", () => {
    const store = new PlayStore();
    const d = new PlayDeduper(store);
    const t = (day: number) => Date.UTC(2022, 0, day, 12);
    d.add(play({ source: "account", endMs: t(1), track: "before" }));
    d.add(play({ source: "account", endMs: t(10), track: "inside-1" }));
    d.add(play({ source: "account", endMs: t(20), track: "inside-2" }));
    d.add(play({ source: "account", endMs: t(31), track: "after" }));
    d.add(play({ source: "extended", endMs: t(10), track: "ext-min" }));
    d.add(play({ source: "extended", endMs: t(20), track: "ext-max" }));
    expect(dropAccountOverlap(store)).toBe(2);
    expect(store.length).toBe(4);
    const tracks = Array.from({ length: store.length }, (_, i) => store.at(i).track).sort();
    expect(tracks).toEqual(["after", "before", "ext-max", "ext-min"]);
  });
  it("drops nothing without Extended data", () => {
    const store = new PlayStore();
    new PlayDeduper(store).add(play());
    expect(dropAccountOverlap(store)).toBe(0);
    expect(store.length).toBe(1);
  });
});

describe("PlayStore", () => {
  it("round-trips plays through the columns and interns strings", () => {
    const store = new PlayStore(16);
    const a = play({ album: "Alb", skipped: true, source: "extended", kind: "podcast" });
    const b = play({ skipped: false });
    store.push(a);
    store.push(b);
    expect(store.at(0)).toEqual(a);
    expect(store.at(1)).toEqual(b);
    expect(store.internedCount).toBe(3);      // A, T, Alb
  });
});

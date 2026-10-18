// De-dupe rules (eng/frontend.md § Normalised model):
//  1. A file whose name and byte size match an already-read file is skipped and reported.
//  2. Within one source, a play is a duplicate if (endMs, msPlayed, artist, track) all match.
//  3. When Extended data is present, Account plays inside the Extended [min endMs, max endMs]
//     range are dropped (overlapDropped).
import type { ExportKind, Play } from "../model/types";
import { PlayStore } from "./store";

function baseName(name: string): string {
  const parts = name.split(/[\\/]/);
  return parts[parts.length - 1] ?? name;
}

/** Rule 1: remembers (base name, byte size) of every file read so far. */
export class FileDeduper {
  private seen = new Map<string, string>();

  /** Returns the name of the earlier identical file, or null when this one is new (and remembers it). */
  check(name: string, size: number): string | null {
    const key = `${baseName(name).toLowerCase()}\u0000${size}`;
    const earlier = this.seen.get(key);
    if (earlier !== undefined) return earlier;
    this.seen.set(key, name);
    return null;
  }
}

function mix(h: number, v: number): number {
  h = Math.imul(h ^ v, 0x9e3779b1);
  return h ^ (h >>> 15);
}

/**
 * Rule 2: appends plays to the store unless an identical play (same source, endMs, msPlayed,
 * artist, track) is already there. Uses an open-addressing hash table of row indexes, so
 * millions of plays need no per-play key strings.
 */
export class PlayDeduper {
  private tables: Record<ExportKind, Int32Array> = {
    account: new Int32Array(1024).fill(-1),
    extended: new Int32Array(1024).fill(-1),
  };
  private counts: Record<ExportKind, number> = { account: 0, extended: 0 };

  constructor(private readonly store: PlayStore) {}

  private hash(endMs: number, msPlayed: number, artist: number, track: number): number {
    let h = 0x811c9dc5;
    h = mix(h, endMs >>> 0);
    h = mix(h, Math.floor(endMs / 4294967296) | 0);
    h = mix(h, msPlayed >>> 0);
    h = mix(h, artist);
    h = mix(h, track);
    return h >>> 0;
  }

  private rehash(source: ExportKind): void {
    const old = this.tables[source];
    const next = new Int32Array(old.length * 2).fill(-1);
    const mask = next.length - 1;
    for (const row of old) {
      if (row < 0) continue;
      const s = this.store;
      let slot = this.hash(s.endMs(row), s.msPlayed(row), s.artistId(row), s.trackId(row)) & mask;
      while (next[slot]! >= 0) slot = (slot + 1) & mask;
      next[slot] = row;
    }
    this.tables[source] = next;
  }

  /** Adds the play unless it is a duplicate. Returns true when it was added. */
  add(play: Play): boolean {
    const s = this.store;
    const source = play.source;
    if (this.counts[source] * 2 >= this.tables[source].length) this.rehash(source);
    const table = this.tables[source];
    const mask = table.length - 1;
    const artist = s.intern(play.artist);
    const track = s.intern(play.track);
    let slot = this.hash(play.endMs, play.msPlayed, artist, track) & mask;
    for (;;) {
      const row = table[slot]!;
      if (row < 0) break;
      if (
        s.endMs(row) === play.endMs && s.msPlayed(row) === play.msPlayed &&
        s.artistId(row) === artist && s.trackId(row) === track
      ) return false;
      slot = (slot + 1) & mask;
    }
    table[slot] = s.push(play);
    this.counts[source]++;
    return true;
  }
}

/**
 * Rule 3: when Extended plays exist, drops Account plays inside the Extended
 * [min endMs, max endMs] range. Returns how many were dropped.
 */
export function dropAccountOverlap(store: PlayStore): number {
  const range = store.range("extended");
  if (range === null) return 0;
  return store.retain((i) => {
    if (store.source(i) !== "account") return true;
    const t = store.endMs(i);
    return t < range.min || t > range.max;
  });
}

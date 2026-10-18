import type { ExportKind, Play } from "../model/types";

/** Marks "no album" in the album id column. */
export const NO_ALBUM = 0xffffffff;

const KINDS: Play["kind"][] = ["music", "podcast"];
const SOURCES: ExportKind[] = ["account", "extended"];
const SKIPPED: (boolean | null)[] = [null, false, true];

/**
 * Columnar play store. Lives inside the worker only: plays are kept in typed arrays with
 * interned strings (artist, track and album names are stored once), which keeps millions of
 * plays within a phone's memory. `at()` materialises a Play on demand for the stats engine;
 * nothing here is ever posted off the worker.
 */
export class PlayStore {
  private cap: number;
  private n = 0;
  private endMsCol: Float64Array;
  private msPlayedCol: Float64Array;
  private artistCol: Uint32Array;
  private trackCol: Uint32Array;
  private albumCol: Uint32Array;
  private kindCol: Uint8Array;      // index into KINDS
  private skippedCol: Uint8Array;   // index into SKIPPED
  private sourceCol: Uint8Array;    // index into SOURCES
  private strings: string[] = [];
  private ids = new Map<string, number>();

  constructor(initialCapacity = 1024) {
    this.cap = Math.max(16, initialCapacity);
    this.endMsCol = new Float64Array(this.cap);
    this.msPlayedCol = new Float64Array(this.cap);
    this.artistCol = new Uint32Array(this.cap);
    this.trackCol = new Uint32Array(this.cap);
    this.albumCol = new Uint32Array(this.cap);
    this.kindCol = new Uint8Array(this.cap);
    this.skippedCol = new Uint8Array(this.cap);
    this.sourceCol = new Uint8Array(this.cap);
  }

  get length(): number {
    return this.n;
  }

  /** Id of an interned string (added on first use). */
  intern(s: string): number {
    let id = this.ids.get(s);
    if (id === undefined) {
      id = this.strings.length;
      this.strings.push(s);
      this.ids.set(s, id);
    }
    return id;
  }

  /** Number of distinct interned strings (artists, tracks and albums together). */
  get internedCount(): number {
    return this.strings.length;
  }

  private grow(): void {
    this.cap *= 2;
    const f64 = (a: Float64Array) => { const b = new Float64Array(this.cap); b.set(a); return b; };
    const u32 = (a: Uint32Array) => { const b = new Uint32Array(this.cap); b.set(a); return b; };
    const u8 = (a: Uint8Array) => { const b = new Uint8Array(this.cap); b.set(a); return b; };
    this.endMsCol = f64(this.endMsCol);
    this.msPlayedCol = f64(this.msPlayedCol);
    this.artistCol = u32(this.artistCol);
    this.trackCol = u32(this.trackCol);
    this.albumCol = u32(this.albumCol);
    this.kindCol = u8(this.kindCol);
    this.skippedCol = u8(this.skippedCol);
    this.sourceCol = u8(this.sourceCol);
  }

  /** Appends a play and returns its row index. */
  push(play: Play): number {
    if (this.n === this.cap) this.grow();
    const i = this.n++;
    this.endMsCol[i] = play.endMs;
    this.msPlayedCol[i] = play.msPlayed;
    this.artistCol[i] = this.intern(play.artist);
    this.trackCol[i] = this.intern(play.track);
    this.albumCol[i] = play.album === null ? NO_ALBUM : this.intern(play.album);
    this.kindCol[i] = KINDS.indexOf(play.kind);
    this.skippedCol[i] = play.skipped === null ? 0 : play.skipped ? 2 : 1;
    this.sourceCol[i] = SOURCES.indexOf(play.source);
    return i;
  }

  endMs(i: number): number { return this.endMsCol[i]!; }
  msPlayed(i: number): number { return this.msPlayedCol[i]!; }
  artistId(i: number): number { return this.artistCol[i]!; }
  trackId(i: number): number { return this.trackCol[i]!; }
  source(i: number): ExportKind { return SOURCES[this.sourceCol[i]!]!; }

  at(i: number): Play {
    const album = this.albumCol[i]!;
    return {
      endMs: this.endMsCol[i]!,
      msPlayed: this.msPlayedCol[i]!,
      kind: KINDS[this.kindCol[i]!]!,
      artist: this.strings[this.artistCol[i]!]!,
      track: this.strings[this.trackCol[i]!]!,
      album: album === NO_ALBUM ? null : this.strings[album]!,
      skipped: SKIPPED[this.skippedCol[i]!]!,
      source: SOURCES[this.sourceCol[i]!]!,
    };
  }

  /** Min and max endMs over all plays, or null when empty. */
  range(source?: ExportKind): { min: number; max: number } | null {
    let min = Infinity;
    let max = -Infinity;
    const want = source === undefined ? -1 : SOURCES.indexOf(source);
    for (let i = 0; i < this.n; i++) {
      if (want >= 0 && this.sourceCol[i] !== want) continue;
      const t = this.endMsCol[i]!;
      if (t < min) min = t;
      if (t > max) max = t;
    }
    return min === Infinity ? null : { min, max };
  }

  /** Plays per source. */
  countBySource(): Record<ExportKind, number> {
    const out: Record<ExportKind, number> = { account: 0, extended: 0 };
    for (let i = 0; i < this.n; i++) out[SOURCES[this.sourceCol[i]!]!]++;
    return out;
  }

  /** Keeps the rows for which `keep(i)` is true (compacting in place). Returns rows removed. */
  retain(keep: (i: number) => boolean): number {
    let w = 0;
    for (let r = 0; r < this.n; r++) {
      if (!keep(r)) continue;
      if (w !== r) {
        this.endMsCol[w] = this.endMsCol[r]!;
        this.msPlayedCol[w] = this.msPlayedCol[r]!;
        this.artistCol[w] = this.artistCol[r]!;
        this.trackCol[w] = this.trackCol[r]!;
        this.albumCol[w] = this.albumCol[r]!;
        this.kindCol[w] = this.kindCol[r]!;
        this.skippedCol[w] = this.skippedCol[r]!;
        this.sourceCol[w] = this.sourceCol[r]!;
      }
      w++;
    }
    const removed = this.n - w;
    this.n = w;
    return removed;
  }
}

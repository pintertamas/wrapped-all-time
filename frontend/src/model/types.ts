// Normalised model. Normative contract: eng/frontend.md § Normalised model (keep in sync, exactly).

export type ExportKind = "account" | "extended";      // analytics enum: account -> "standard"
export type FileClass = "account-music" | "account-podcast" | "extended-audio"
  | "extended-video" | "spotify-other" | "unrecognised";

export interface Play {            // in-worker only; stored columnar (typed arrays + interned strings)
  endMs: number;                   // epoch ms UTC when playback ended
  msPlayed: number;
  kind: "music" | "podcast";
  artist: string;                  // album artist / artistName / show name
  track: string;                   // track / episode name
  album: string | null;            // Extended only
  skipped: boolean | null;         // Extended only: skipped === true || reason_end === "fwdbtn"
  source: ExportKind;
}

export interface Ranked { name: string; minutes: number; plays: number }
export interface RankedWithArtist extends Ranked { artist: string }

export interface PeriodStats {
  from: string; to: string;        // ISO dates, inclusive, local tz
  minutes: number;                 // music only, rounded
  plays: number;                   // music rows with msPlayed >= 30000
  podcastMinutes: number;
  topArtists: Ranked[];            // up to 50, ranked by minutes, then plays
  topTracks: RankedWithArtist[];   // up to 50
  topAlbums: RankedWithArtist[] | null;   // null without Extended data
  topDay: { date: string; minutes: number } | null;
  longestStreakDays: number;       // consecutive local days with >= 1 play
  activeDays: number;
  firstTrack: { track: string; artist: string; date: string } | null; // Extended only
  skipRate: number | null;         // 0..1, Extended only
  hourMinutes: number[];           // length 24, local hour
}

export interface StatsBundle {
  version: 1;
  tz: string;                      // IANA, from Intl.DateTimeFormat().resolvedOptions().timeZone
  sources: ExportKind[];
  sample: boolean;
  latestPlay: string;              // ISO date
  periods: { "4w": PeriodStats; "6m": PeriodStats; "12m": PeriodStats };  // free
  years: Record<string, PeriodStats>;   // "2016"… only years with data (paid)
  allTime: PeriodStats;                 // paid
}

export interface StructureInfo {   // the only thing "copy file info" ever copies
  fileName: string;
  topLevel: "array" | "object" | "other" | "invalid-json";
  firstItemKeys: string[];         // keys only, never values, max 30
  sizeBucket: "<1MB" | "1-10MB" | "10-100MB" | ">100MB";
}
export interface FileReport { name: string; cls: FileClass; plays: number; skippedRows: number;
  duplicateOf: string | null; structure: StructureInfo | null }
export interface ImportSummary { sources: ExportKind[]; years: number[]; firstPlay: string;
  lastPlay: string; totalPlays: number; files: FileReport[]; duplicatesSkipped: number;
  overlapDropped: number }
export type ImportErrorCode = "no-history-files" | "invalid-zip" | "invalid-json"
  | "out-of-memory" | "cancelled" | "unknown";

import type { Play } from "../../model/types";
import { num, str, type AdapterResult } from "./types";

/** "YYYY-MM-DD HH:mm" (UTC) -> epoch ms, or null. */
export function parseAccountTime(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(v.trim());
  if (!m) return null;
  const t = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, m[6] ? +m[6] : 0);
  return Number.isNaN(t) ? null : t;
}

/** StreamingHistory_music_N / legacy StreamingHistoryN rows. Reads only the allow-listed fields. */
export function adaptAccountMusic(rows: unknown[]): AdapterResult {
  const plays: Play[] = [];
  let skippedRows = 0;
  for (const row of rows) {
    const r = (row ?? {}) as Record<string, unknown>;
    const endMs = parseAccountTime(r["endTime"]);
    const artist = str(r["artistName"]);
    const track = str(r["trackName"]);
    const msPlayed = num(r["msPlayed"]);
    if (endMs === null || artist === null || track === null || msPlayed === null) {
      skippedRows++;
      continue;
    }
    plays.push({ endMs, msPlayed, kind: "music", artist, track, album: null, skipped: null, source: "account" });
  }
  return { plays, skippedRows };
}

/** StreamingHistory_podcast_N rows (podcast minutes only). */
export function adaptAccountPodcast(rows: unknown[]): AdapterResult {
  const plays: Play[] = [];
  let skippedRows = 0;
  for (const row of rows) {
    const r = (row ?? {}) as Record<string, unknown>;
    const endMs = parseAccountTime(r["endTime"]);
    const artist = str(r["podcastName"]);
    const track = str(r["episodeName"]) ?? "";
    const msPlayed = num(r["msPlayed"]);
    if (endMs === null || artist === null || msPlayed === null) {
      skippedRows++;
      continue;
    }
    plays.push({ endMs, msPlayed, kind: "podcast", artist, track, album: null, skipped: null, source: "account" });
  }
  return { plays, skippedRows };
}

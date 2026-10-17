import type { Play } from "../../model/types";
import { num, str, type AdapterResult } from "./types";

/**
 * Streaming_History_Audio_* and legacy endsong_N rows. Reads only the allow-listed fields;
 * ip_addr, username, user_agent_decrypted, conn_country, platform etc. are never touched.
 * Null track/artist rows become podcast rows when episode_show_name is set, else are skipped.
 */
export function adaptExtendedAudio(rows: unknown[]): AdapterResult {
  const plays: Play[] = [];
  let skippedRows = 0;
  for (const row of rows) {
    const r = (row ?? {}) as Record<string, unknown>;
    const tsRaw = r["ts"];
    const endMs = typeof tsRaw === "string" ? Date.parse(tsRaw) : NaN;
    const msPlayed = num(r["ms_played"]);
    if (Number.isNaN(endMs) || msPlayed === null) {
      skippedRows++;
      continue;
    }
    const skipped = r["skipped"] === true || r["reason_end"] === "fwdbtn";
    const track = str(r["master_metadata_track_name"]);
    const artist = str(r["master_metadata_album_artist_name"]);
    let play: Play;
    if (track !== null && artist !== null) {
      play = {
        endMs, msPlayed, kind: "music", artist, track,
        album: str(r["master_metadata_album_album_name"]), skipped, source: "extended",
      };
    } else {
      const show = str(r["episode_show_name"]);
      if (show === null) {
        skippedRows++;
        continue;
      }
      play = {
        endMs, msPlayed, kind: "podcast", artist: show, track: str(r["episode_name"]) ?? "",
        album: null, skipped, source: "extended",
      };
    }
    plays.push(play);
  }
  return { plays, skippedRows };
}

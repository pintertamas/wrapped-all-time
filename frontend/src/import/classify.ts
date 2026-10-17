import type { FileClass, StructureInfo } from "../model/types";

/** Spotify files that are part of an export but never parsed. */
const OTHER_NAMES = [
  /^userdata/, /^yourlibrary/, /^playlist\d*/, /^identity/, /^follow/, /^searchqueries/,
  /^inferences/, /^payments/, /^read_me_first/, /^marquee/, /^messagedata/, /^wrapped/,
  /^duo/, /^family/, /^voice/, /^spotify/,
];

function baseName(fileName: string): string {
  const parts = fileName.split(/[\\/]/);
  return parts[parts.length - 1] ?? fileName;
}

function classifyByName(fileName: string): FileClass | null {
  const n = baseName(fileName).toLowerCase();
  if (!n.endsWith(".json")) return null;
  if (/^streaminghistory_music_\d+\.json$/.test(n) || /^streaminghistory\d+\.json$/.test(n)) {
    return "account-music";
  }
  if (/^streaminghistory_podcast_\d+\.json$/.test(n)) return "account-podcast";
  if (/^streaming_history_audio_.+\.json$/.test(n) || /^endsong_\d+\.json$/.test(n)) {
    return "extended-audio";
  }
  if (/^streaming_history_video_.+\.json$/.test(n)) return "extended-video";
  if (OTHER_NAMES.some((re) => re.test(n))) return "spotify-other";
  return null;
}

function classifyByKeys(firstItem: unknown): FileClass {
  if (firstItem === null || typeof firstItem !== "object" || Array.isArray(firstItem)) {
    return "unrecognised";
  }
  const has = (k: string) => k in (firstItem as Record<string, unknown>);
  if (has("endTime") && has("podcastName") && has("episodeName")) return "account-podcast";
  if (has("endTime") && has("artistName") && has("trackName")) return "account-music";
  if (has("ts") && has("ms_played")) {
    return has("video_name") || has("video_title") ? "extended-video" : "extended-audio";
  }
  return "unrecognised";
}

/**
 * Classify a file by name first; if the name is not recognised, by the keys
 * of the first array item (so renamed files still work).
 */
export function classify(fileName: string, firstItem?: unknown): FileClass {
  return classifyByName(fileName) ?? classifyByKeys(firstItem);
}

const MB = 1024 * 1024;

export function sizeBucket(bytes: number): StructureInfo["sizeBucket"] {
  if (bytes < MB) return "<1MB";
  if (bytes < 10 * MB) return "1-10MB";
  if (bytes < 100 * MB) return "10-100MB";
  return ">100MB";
}

export const MAX_STRUCTURE_KEYS = 30;

/** Structure only: key names of the first item and a size bucket. Never values. */
export function buildStructureInfo(
  fileName: string,
  parsed: unknown,
  sizeBytes: number,
  invalidJson = false,
): StructureInfo {
  let topLevel: StructureInfo["topLevel"];
  let firstItemKeys: string[] = [];
  if (invalidJson) topLevel = "invalid-json";
  else if (Array.isArray(parsed)) {
    topLevel = "array";
    const first: unknown = parsed[0];
    if (first !== null && typeof first === "object" && !Array.isArray(first)) {
      firstItemKeys = Object.keys(first).slice(0, MAX_STRUCTURE_KEYS);
    }
  } else if (parsed !== null && typeof parsed === "object") {
    topLevel = "object";
    firstItemKeys = Object.keys(parsed).slice(0, MAX_STRUCTURE_KEYS);
  } else topLevel = "other";
  return { fileName: baseName(fileName), topLevel, firstItemKeys, sizeBucket: sizeBucket(sizeBytes) };
}

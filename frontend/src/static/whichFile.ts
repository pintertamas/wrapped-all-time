import { classify } from "../import/classify";

export interface WhichFileResult {
  kind: "account" | "extended" | "other" | "unknown";
  message: string;
}

/** Tells which export a file name belongs to. Pure; the name never leaves the page. */
export function whichFile(name: string): WhichFileResult {
  const n = name.trim().toLowerCase();
  if (/^my_spotify_data(\s*\(\d+\))?(\.zip)?$/.test(n)) {
    return { kind: "account", message: "This is the Account Data package. It covers about the last 12 months." };
  }
  if (/^my_spotify_extended_streaming_history(\s*\(\d+\))?(\.zip)?$/.test(n)) {
    return { kind: "extended", message: "This is the Extended streaming history package. It covers your whole account." };
  }
  const cls = classify(n);
  if (cls === "account-music" || cls === "account-podcast") {
    return { kind: "account", message: "This file is from the Account Data package (about the last 12 months)." };
  }
  if (cls === "extended-audio" || cls === "extended-video") {
    return { kind: "extended", message: "This file is from the Extended streaming history package (whole account)." };
  }
  if (cls === "spotify-other") {
    return { kind: "other", message: "This is a Spotify export file, but it holds no listening history. You can skip it." };
  }
  return { kind: "unknown", message: "We do not recognise this name. Look for StreamingHistory or Streaming_History_Audio files." };
}

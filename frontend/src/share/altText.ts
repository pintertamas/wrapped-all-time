import type { PeriodStats } from "../model/types";

const nf = new Intl.NumberFormat("en-US");

/** Plain-language description of a card, built only from the data on it. */
export function buildAltText(stats: PeriodStats, periodLabel: string, sample = false): string {
  const parts = [
    `${sample ? "Sample " : ""}listening recap for ${periodLabel}: ${nf.format(stats.minutes)} minutes across ${nf.format(stats.plays)} plays.`,
  ];
  const artists = stats.topArtists.slice(0, 3).map((a) => a.name);
  if (artists.length > 0) parts.push(`Top artists: ${artists.join(", ")}.`);
  const track = stats.topTracks[0];
  if (track) parts.push(`Top track: ${track.name} by ${track.artist}.`);
  if (sample) parts.push("Marked as sample data.");
  return parts.join(" ");
}

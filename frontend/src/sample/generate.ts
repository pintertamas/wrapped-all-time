/**
 * Seeded synthetic listening history in the Extended streaming-history row shape.
 * Deterministic: same seed -> identical output. All names are fictional.
 * Standalone (no imports) so scripts/make-fixtures.mjs can load it with Node type stripping.
 */

export interface ExtendedRow {
  ts: string;
  ms_played: number;
  master_metadata_track_name: string | null;
  master_metadata_album_artist_name: string | null;
  master_metadata_album_album_name: string | null;
  episode_name: string | null;
  episode_show_name: string | null;
  reason_end: string;
  skipped: boolean;
}

export interface GenerateOptions {
  /** First day of the history (UTC). Default 2020-01-01. */
  startMs?: number;
  years?: number;
  /** Average plays per day. Default 12. */
  playsPerDay?: number;
  /** Append to every artist/track/album name (used for the canary ZIP). */
  namePrefix?: string;
}

/** mulberry32 PRNG */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const A = ["Velvet", "Neon", "Quiet", "Paper", "Hollow", "Golden", "Static", "Lunar", "Amber", "Cobalt", "Fading", "Wild"];
const B = ["Harbor", "Orchard", "Engines", "Lanterns", "Tides", "Garden", "Signals", "Meadow", "Circuit", "Comets", "Rivers", "Echoes"];
const T1 = ["Midnight", "Slow", "Glass", "Paper", "Open", "Last", "Little", "Burning", "Distant", "Soft"];
const T2 = ["Window", "Highway", "Morning", "Rain", "Letter", "Dance", "Season", "Voice", "Island", "Fire"];
const SHOWS = ["The Imaginary Hour", "Notes From Nowhere", "Fictional Futures"];

export const SAMPLE_START_MS = Date.UTC(2020, 0, 1);

export function generate(seed: number, opts: GenerateOptions = {}): ExtendedRow[] {
  const rand = rng(seed);
  const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)]!;
  const pre = opts.namePrefix ?? "";
  const startMs = opts.startMs ?? SAMPLE_START_MS;
  const years = opts.years ?? 6;
  const perDay = opts.playsPerDay ?? 12;

  const artists = Array.from({ length: 40 }, (_, i) => {
    const name = `${pre}${pick(A)} ${pick(B)} ${i + 1}`;
    const tracks = Array.from({ length: 8 }, (_, j) => ({
      track: `${pre}${pick(T1)} ${pick(T2)} ${j + 1}`,
      album: `${pre}${name} Vol. ${(j % 3) + 1}`,
    }));
    return { name, tracks };
  });

  const rows: ExtendedRow[] = [];
  const days = Math.round(years * 365.25);
  for (let d = 0; d < days; d++) {
    const n = Math.floor(rand() * perDay * 2);
    let tod = 7 * 3600000 + Math.floor(rand() * 3600000);
    for (let k = 0; k < n; k++) {
      const skipped = rand() < 0.15;
      const msPlayed = skipped ? 1000 + Math.floor(rand() * 25000) : 90000 + Math.floor(rand() * 240000);
      tod += msPlayed + Math.floor(rand() * 600000);
      const ts = new Date(startMs + d * 86400000 + tod).toISOString().replace(/\.\d{3}Z$/, "Z");
      if (rand() < 0.04) {
        rows.push({
          ts, ms_played: msPlayed * 8, master_metadata_track_name: null,
          master_metadata_album_artist_name: null, master_metadata_album_album_name: null,
          episode_name: `${pre}Episode ${1 + Math.floor(rand() * 50)}`, episode_show_name: `${pre}${pick(SHOWS)}`,
          reason_end: "trackdone", skipped: false,
        });
        continue;
      }
      // skewed artist choice so top lists are meaningful
      const art = artists[Math.floor(rand() * rand() * artists.length)]!;
      const t = pick(art.tracks);
      rows.push({
        ts, ms_played: msPlayed, master_metadata_track_name: t.track,
        master_metadata_album_artist_name: art.name, master_metadata_album_album_name: t.album,
        episode_name: null, episode_show_name: null,
        reason_end: skipped ? "fwdbtn" : "trackdone", skipped,
      });
    }
  }
  return rows;
}

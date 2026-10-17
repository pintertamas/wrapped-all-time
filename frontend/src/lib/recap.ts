import type { Artist, Profile, TimeRange, Track } from '../data/sampleProfile'

export interface Recap {
  topArtists: Artist[]
  topTracks: Track[]
  topGenres: { genre: string; count: number }[]
  /** 24 buckets, index = hour of day (UTC), value = number of recent plays. */
  hourHistogram: number[]
}

/** Only what the Spotify Web API can supply: no minutes or play counts. */
export function recap(profile: Profile, range: TimeRange): Recap {
  const artists = profile.topArtists[range]
  const counts = new Map<string, number>()
  for (const a of artists) {
    for (const g of a.genres) counts.set(g, (counts.get(g) ?? 0) + 1)
  }
  const topGenres = [...counts.entries()]
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre))
    .slice(0, 5)

  const hourHistogram = Array<number>(24).fill(0)
  for (const p of profile.recentlyPlayed) {
    hourHistogram[new Date(p.played_at).getUTCHours()] += 1
  }

  return {
    topArtists: artists.slice(0, 5),
    topTracks: profile.topTracks[range].slice(0, 5),
    topGenres,
    hourHistogram,
  }
}

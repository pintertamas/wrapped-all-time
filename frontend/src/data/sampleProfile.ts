// Sample data shaped like Spotify Web API responses. All names are fictional.
export type TimeRange = 'short_term' | 'medium_term' | 'long_term'

export interface Artist {
  id: string
  name: string
  genres: string[]
  popularity: number
}

export interface Track {
  id: string
  name: string
  artists: { id: string; name: string }[]
  album: { name: string }
}

export interface RecentPlay {
  played_at: string
  track: Track
}

export interface Profile {
  topArtists: Record<TimeRange, Artist[]>
  topTracks: Record<TimeRange, Track[]>
  recentlyPlayed: RecentPlay[]
}

const GENRES: string[][] = [
  ['indie pop', 'dream pop'],
  ['synthwave', 'electronic'],
  ['folk', 'indie folk'],
  ['jazz fusion', 'jazz'],
  ['lo-fi', 'chillhop'],
  ['post-rock', 'ambient'],
  ['funk', 'disco'],
  ['shoegaze', 'indie rock'],
  ['bossa nova', 'jazz'],
  ['house', 'electronic'],
]

const NAMES = [
  'Velvet Lanterns', 'Neon Orchard', 'The Paper Cranes', 'Midnight Harbor',
  'Copper Fields', 'Static Bloom', 'Glass Meridian', 'Ocean Static',
  'Amber Cartel', 'Quiet Comets', 'Lunar Parade', 'Saffron Skyline',
]

export const artists: Artist[] = NAMES.map((name, i) => ({
  id: `artist${i + 1}`,
  name,
  genres: GENRES[i % GENRES.length],
  popularity: 40 + ((i * 7) % 50),
}))

const TITLES = [
  'Paper Moons', 'Slow Tide', 'Afterglow Drive', 'Cinder Hearts', 'Window Seat',
  'Blue Hour', 'Hollow Bells', 'Soft Static', 'Night Bus', 'Golden Thread',
  'River Lights', 'Tangerine Sky', 'Echo Garden', 'Low Orbit', 'Velvet Rain',
  'Last Train Home', 'Marigold', 'Highway Hum', 'Small Fires', 'Daybreak Loop',
]

export const tracks: Track[] = TITLES.map((name, i) => {
  const a = artists[i % artists.length]
  return {
    id: `track${i + 1}`,
    name,
    artists: [{ id: a.id, name: a.name }],
    album: { name: `${name} (Sessions)` },
  }
})

function rotate<T>(list: T[], start: number, count: number): T[] {
  return Array.from({ length: count }, (_, i) => list[(start + i) % list.length])
}

// 50 plays, 30 minutes apart going back from a fixed time (deterministic).
const NEWEST = Date.UTC(2026, 9, 16, 22, 0, 0)
const recentlyPlayed: RecentPlay[] = Array.from({ length: 50 }, (_, i) => ({
  played_at: new Date(NEWEST - i * 95 * 60 * 1000).toISOString(),
  track: tracks[(i * 7) % tracks.length],
}))

export const sampleProfile: Profile = {
  topArtists: {
    short_term: rotate(artists, 0, 10),
    medium_term: rotate(artists, 3, 10),
    long_term: rotate(artists, 6, 10),
  },
  topTracks: {
    short_term: rotate(tracks, 0, 10),
    medium_term: rotate(tracks, 5, 10),
    long_term: rotate(tracks, 11, 10),
  },
  recentlyPlayed,
}

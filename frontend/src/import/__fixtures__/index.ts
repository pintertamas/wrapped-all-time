// Synthetic fixtures only: invented names, no real listening data.

export const accountMusic: unknown[] = [
  { endTime: "2023-03-01 20:15", artistName: "Test Artist A", trackName: "Song One", msPlayed: 180000 },
  { endTime: "2023-03-01 20:20", artistName: "Test Artist B", trackName: "Song Two", msPlayed: 12000 },
  { endTime: "bad", artistName: "Test Artist B", trackName: "Song Two", msPlayed: 1000 },
  { endTime: "2023-03-02 08:00", artistName: "", trackName: "No Artist", msPlayed: 1000 },
];

export const accountPodcast: unknown[] = [
  { endTime: "2023-03-03 07:30", podcastName: "Test Show", episodeName: "Episode 1", msPlayed: 600000 },
  { endTime: "2023-03-03 07:40", episodeName: "Orphan", msPlayed: 1000 },
];

export const CANARY = "CANARY-SENSITIVE-VALUE";

const sensitive = {
  ip_addr: CANARY,
  username: CANARY,
  user_agent_decrypted: CANARY,
  conn_country: CANARY,
  platform: CANARY,
};

export const extendedAudio: unknown[] = [
  {
    ts: "2022-05-01T10:00:00Z", ms_played: 200000, master_metadata_track_name: "Ext Song",
    master_metadata_album_artist_name: "Ext Artist", master_metadata_album_album_name: "Ext Album",
    episode_name: null, episode_show_name: null, skipped: false, reason_end: "trackdone", ...sensitive,
  },
  {
    ts: "2022-05-01T10:05:00Z", ms_played: 4000, master_metadata_track_name: "Skipped Song",
    master_metadata_album_artist_name: "Ext Artist", master_metadata_album_album_name: "Ext Album",
    episode_name: null, episode_show_name: null, skipped: null, reason_end: "fwdbtn", ...sensitive,
  },
  {
    ts: "2022-05-02T09:00:00Z", ms_played: 900000, master_metadata_track_name: null,
    master_metadata_album_artist_name: null, master_metadata_album_album_name: null,
    episode_name: "Ext Episode", episode_show_name: "Ext Show", skipped: null, reason_end: "endplay", ...sensitive,
  },
  {
    ts: "2022-05-02T11:00:00Z", ms_played: 500, master_metadata_track_name: null,
    master_metadata_album_artist_name: null, master_metadata_album_album_name: null,
    episode_name: null, episode_show_name: null, skipped: null, reason_end: "unknown", ...sensitive,
  },
];

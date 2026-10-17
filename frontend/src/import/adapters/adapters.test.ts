import { describe, expect, it } from "vitest";
import { accountMusic, accountPodcast, CANARY, extendedAudio } from "../__fixtures__";
import { adaptAccountMusic, adaptAccountPodcast } from "./account";
import { adaptExtendedAudio } from "./extended";

describe("account adapters", () => {
  it("maps music rows and counts bad rows", () => {
    const { plays, skippedRows } = adaptAccountMusic(accountMusic);
    expect(skippedRows).toBe(2);
    expect(plays).toHaveLength(2);
    expect(plays[0]).toEqual({
      endMs: Date.UTC(2023, 2, 1, 20, 15), msPlayed: 180000, kind: "music",
      artist: "Test Artist A", track: "Song One", album: null, skipped: null, source: "account",
    });
  });
  it("maps podcast rows", () => {
    const { plays, skippedRows } = adaptAccountPodcast(accountPodcast);
    expect(skippedRows).toBe(1);
    expect(plays[0]).toMatchObject({ kind: "podcast", artist: "Test Show", track: "Episode 1", source: "account" });
  });
});

describe("extended adapter", () => {
  const { plays, skippedRows } = adaptExtendedAudio(extendedAudio);
  it("maps music, skip flags and podcast rows; counts unusable rows", () => {
    expect(plays).toHaveLength(3);
    expect(skippedRows).toBe(1);
    expect(plays[0]).toMatchObject({ kind: "music", album: "Ext Album", skipped: false, source: "extended" });
    expect(plays[1]!.skipped).toBe(true);
    expect(plays[2]).toMatchObject({ kind: "podcast", artist: "Ext Show", track: "Ext Episode", album: null });
    expect(plays[0]!.endMs).toBe(Date.parse("2022-05-01T10:00:00Z"));
  });
  it("never exposes ip_addr, username, user_agent_decrypted, conn_country or platform", () => {
    const allowed = ["endMs", "msPlayed", "kind", "artist", "track", "album", "skipped", "source"].sort();
    const all = [
      ...plays, ...adaptAccountMusic(accountMusic).plays, ...adaptAccountPodcast(accountPodcast).plays,
    ];
    for (const p of all) expect(Object.keys(p).sort()).toEqual(allowed);
    const json = JSON.stringify(all);
    expect(json).not.toContain(CANARY);
    for (const k of ["ip_addr", "username", "user_agent_decrypted", "conn_country", "platform"]) {
      expect(json).not.toContain(k);
    }
  });
});

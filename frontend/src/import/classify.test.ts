import { describe, expect, it } from "vitest";
import { buildStructureInfo, classify } from "./classify";

describe("classify by name", () => {
  const cases: [string, string][] = [
    ["StreamingHistory_music_0.json", "account-music"],
    ["StreamingHistory0.json", "account-music"],
    ["MyData/StreamingHistory12.json", "account-music"],
    ["StreamingHistory_podcast_1.json", "account-podcast"],
    ["Streaming_History_Audio_2019-2021_3.json", "extended-audio"],
    ["endsong_4.json", "extended-audio"],
    ["Streaming_History_Video_2020-2022.json", "extended-video"],
    ["Userdata.json", "spotify-other"],
    ["YourLibrary.json", "spotify-other"],
    ["Playlist1.json", "spotify-other"],
    ["random.json", "unrecognised"],
    ["notes.txt", "unrecognised"],
  ];
  it.each(cases)("%s -> %s", (name, cls) => {
    expect(classify(name)).toBe(cls);
  });
});

describe("classify fallback to first-item keys", () => {
  it("recognises renamed files", () => {
    expect(classify("a.json", { endTime: "x", artistName: "a", trackName: "t", msPlayed: 1 })).toBe("account-music");
    expect(classify("b.json", { endTime: "x", podcastName: "p", episodeName: "e", msPlayed: 1 })).toBe("account-podcast");
    expect(classify("c.json", { ts: "x", ms_played: 1, master_metadata_track_name: null })).toBe("extended-audio");
  });
  it("is unrecognised for unknown or missing items", () => {
    expect(classify("d.json", { foo: 1 })).toBe("unrecognised");
    expect(classify("e.json", undefined)).toBe("unrecognised");
    expect(classify("f.json", [1])).toBe("unrecognised");
  });
});

describe("buildStructureInfo", () => {
  it("returns keys only and never values", () => {
    const info = buildStructureInfo("x/f.json", [{ a: "CANARY-VALUE", b: 1 }], 500);
    expect(info).toEqual({ fileName: "f.json", topLevel: "array", firstItemKeys: ["a", "b"], sizeBucket: "<1MB" });
    expect(JSON.stringify(info)).not.toContain("CANARY");
  });
  it("caps keys at 30 and buckets sizes", () => {
    const item = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`k${i}`, "CANARY"]));
    const info = buildStructureInfo("f.json", [item], 5 * 1024 * 1024);
    expect(info.firstItemKeys).toHaveLength(30);
    expect(info.sizeBucket).toBe("1-10MB");
    expect(buildStructureInfo("f.json", [], 50 * 1024 * 1024).sizeBucket).toBe("10-100MB");
    expect(buildStructureInfo("f.json", [], 200 * 1024 * 1024).sizeBucket).toBe(">100MB");
  });
  it("handles object, other and invalid json", () => {
    expect(buildStructureInfo("f.json", { k: "CANARY" }, 1).topLevel).toBe("object");
    expect(buildStructureInfo("f.json", 5, 1).topLevel).toBe("other");
    expect(buildStructureInfo("f.json", undefined, 1, true)).toMatchObject({ topLevel: "invalid-json", firstItemKeys: [] });
  });
});

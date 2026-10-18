import { describe, expect, it } from "vitest";
import { accountMusic, accountPodcast, CANARY, extendedAudio } from "./__fixtures__";
import { json, memFile, zipFile } from "./__fixtures__/files";
import {
  createWorkerHandler, ImportError, runPipeline, throttleProgress, yearsWithData,
  type InputFile, type ProgressInfo,
} from "./pipeline";
import type { FromWorker } from "./protocol";
import { PlayStore } from "./store";

const TZ = "UTC";
const run = (files: InputFile[], extra: Partial<Parameters<typeof runPipeline>[1]> = {}) =>
  runPipeline(files, { tz: TZ, ...extra });

async function failure(promise: Promise<unknown>): Promise<ImportError> {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(ImportError);
    return e as ImportError;
  }
  throw new Error("expected the pipeline to fail");
}

function extRows(n: number, startMs: number, prefix: string): unknown[] {
  return Array.from({ length: n }, (_, i) => ({
    ts: new Date(startMs + i * 240_000).toISOString(), ms_played: 200000 + i,
    master_metadata_track_name: `${prefix} Song ${i}`, master_metadata_album_artist_name: `${prefix} Artist ${i % 7}`,
    master_metadata_album_album_name: `${prefix} Album`, episode_name: null, episode_show_name: null,
    skipped: false, reason_end: "trackdone", ip_addr: CANARY,
  }));
}

const fullZip = () => zipFile("my_spotify_data.zip", {
  "Spotify Account Data/StreamingHistory_music_0.json": accountMusic,
  "Spotify Account Data/StreamingHistory_podcast_0.json": accountPodcast,
  "Spotify Account Data/Userdata.json": { username: CANARY },
  "Spotify Extended Streaming History/Streaming_History_Audio_2022_0.json": extendedAudio,
  "Spotify Extended Streaming History/Streaming_History_Video_2022.json": [],
  "Spotify Extended Streaming History/ReadMeFirst_ExtendedStreamingHistory.pdf": "not json",
  "__MACOSX/._Userdata.json": "junk",
});

describe("pipeline: happy paths", () => {
  it("reads a ZIP in tiny chunks, classifies every JSON entry and counts plays", async () => {
    const progress: ProgressInfo[] = [];
    const { summary, store } = await run([fullZip()], { chunkBytes: 64, onProgress: (p) => progress.push(p) });
    expect(summary.sources).toEqual(["account", "extended"]);
    expect(summary.totalPlays).toBe(store.length);
    expect(summary.totalPlays).toBe(2 + 1 + 3);
    expect(summary.duplicatesSkipped).toBe(0);
    expect(summary.overlapDropped).toBe(0);
    expect(summary.years).toEqual([2022, 2023]);
    expect(summary.firstPlay).toBe("2022-05-01");
    expect(summary.lastPlay).toBe("2023-03-03");
    const byName = Object.fromEntries(summary.files.map((f) => [f.name.split("/").pop()!, f]));
    expect(byName["StreamingHistory_music_0.json"]).toMatchObject({ cls: "account-music", plays: 2, skippedRows: 2 });
    expect(byName["StreamingHistory_podcast_0.json"]).toMatchObject({ cls: "account-podcast", plays: 1, skippedRows: 1 });
    expect(byName["Streaming_History_Audio_2022_0.json"]).toMatchObject({ cls: "extended-audio", plays: 3, skippedRows: 1 });
    expect(byName["Userdata.json"]).toMatchObject({ cls: "spotify-other", plays: 0 });
    expect(byName["Streaming_History_Video_2022.json"]).toMatchObject({ cls: "extended-video", plays: 0 });
    expect(summary.files).toHaveLength(5);             // pdf and __MACOSX junk are not reported
    // streamed chunk by chunk: many progress ticks, monotonic bytes, ends at the file size
    expect(progress.length).toBeGreaterThan(10);
    const bytes = progress.map((p) => p.bytesDone);
    expect([...bytes].sort((a, b) => a - b)).toEqual(bytes);
    expect(bytes[bytes.length - 1]).toBe(progress[0]!.bytesTotal);
    expect(progress[progress.length - 1]).toMatchObject({ filesDone: 1, filesTotal: 1 });
    expect(progress.some((p) => p.currentFile.endsWith("Streaming_History_Audio_2022_0.json"))).toBe(true);
  });

  it("handles stored (uncompressed) entries", async () => {
    const { summary } = await run([zipFile("a.zip", { "x/Streaming_History_Audio_1.json": extendedAudio }, 0)]);
    expect(summary.totalPlays).toBe(3);
  });

  it("reads loose JSON files and sniffs renamed files by their keys", async () => {
    const { summary } = await run([
      memFile("StreamingHistory_music_0.json", json(accountMusic)),
      memFile("my-history-copy.json", json(extendedAudio)),
      memFile("mystery.json", json([{ foo: 1, bar: "x" }])),
    ]);
    const cls = summary.files.map((f) => f.cls);
    expect(cls).toEqual(["account-music", "extended-audio", "unrecognised"]);
    expect(summary.files[2]!.structure).toMatchObject({ topLevel: "array", firstItemKeys: ["foo", "bar"] });
    expect(summary.files[0]!.structure).toBeNull();
  });

  it("keeps year membership in the user's time zone", () => {
    const store = new PlayStore();
    const base = { msPlayed: 1, kind: "music" as const, artist: "a", track: "t", album: null, skipped: null, source: "account" as const };
    store.push({ ...base, endMs: Date.UTC(2021, 11, 31, 23, 30) });
    expect(yearsWithData(store, "UTC")).toEqual([2021]);
    expect(yearsWithData(store, "Europe/Budapest")).toEqual([2022]);
  });
});

describe("pipeline: de-dupe", () => {
  it("rule 1: skips a file with the same name and size, reports duplicateOf, without counting its plays", async () => {
    const a = memFile("StreamingHistory_music_0.json", json(accountMusic));
    const b = memFile("copy/StreamingHistory_music_0.json", json(accountMusic));
    const { summary } = await run([a, b]);
    expect(summary.totalPlays).toBe(2);
    expect(summary.files[1]).toMatchObject({ plays: 0, duplicateOf: "StreamingHistory_music_0.json" });
  });

  it("rule 1 also applies to ZIP entries repeated in a second ZIP", async () => {
    const entries = { "d/StreamingHistory_music_0.json": accountMusic };
    const { summary } = await run([zipFile("one.zip", entries), zipFile("two.zip", entries)]);
    expect(summary.totalPlays).toBe(2);
    expect(summary.files.filter((f) => f.duplicateOf !== null)).toHaveLength(1);
  });

  it("rule 2: drops duplicate plays within a source and reports duplicatesSkipped", async () => {
    // same plays in two differently named (and sized) files of the same source
    const more = [...accountMusic, { endTime: "2023-04-01 10:00", artistName: "Test Artist C", trackName: "Song Three", msPlayed: 90000 }];
    const { summary } = await run([
      memFile("StreamingHistory_music_0.json", json(accountMusic)),
      memFile("StreamingHistory_music_1.json", json(more)),
    ]);
    expect(summary.duplicatesSkipped).toBe(2);
    expect(summary.totalPlays).toBe(3);
    expect(summary.files[1]!.plays).toBe(1);
  });

  it("rule 3: Account plays inside the Extended range are counted in overlapDropped", async () => {
    const start = Date.UTC(2022, 5, 1, 12);
    const ext = extRows(10, start, "Ext");                       // spans about 36 minutes
    const accountInside = [
      { endTime: "2022-06-01 12:10", artistName: "Acc In", trackName: "inside", msPlayed: 100000 },
      { endTime: "2022-06-01 12:20", artistName: "Acc In", trackName: "inside 2", msPlayed: 100000 },
    ];
    const accountOutside = [
      { endTime: "2022-05-01 12:10", artistName: "Acc Out", trackName: "before", msPlayed: 100000 },
      { endTime: "2022-07-01 12:10", artistName: "Acc Out", trackName: "after", msPlayed: 100000 },
    ];
    const { summary, store } = await run([
      memFile("StreamingHistory_music_0.json", json([...accountInside, ...accountOutside])),
      memFile("Streaming_History_Audio_2022_0.json", json(ext)),
    ]);
    expect(summary.overlapDropped).toBe(2);
    expect(summary.totalPlays).toBe(12);
    expect(store.length).toBe(12);
    const artists = new Set(Array.from({ length: store.length }, (_, i) => store.at(i).artist));
    expect(artists.has("Acc In")).toBe(false);
    expect(artists.has("Acc Out")).toBe(true);
  });
});

describe("pipeline: error codes", () => {
  it("no-history-files: a ZIP with only other Spotify files, and a loose unrelated file", async () => {
    const e1 = await failure(run([zipFile("a.zip", { "Userdata.json": { x: 1 }, "YourLibrary.json": {} })]));
    expect(e1.code).toBe("no-history-files");
    expect(e1.summary?.files.map((f) => f.cls)).toEqual(["spotify-other", "spotify-other"]);
    const e2 = await failure(run([memFile("notes.txt", "hello")]));
    expect(e2.code).toBe("no-history-files");
    const e3 = await failure(run([memFile("empty.json", json([]))]));
    expect(e3.code).toBe("no-history-files");
  });

  it("invalid-zip: garbage with a .zip name, a truncated ZIP, and a ZIP without entries", async () => {
    expect((await failure(run([memFile("data.zip", "this is not a zip file at all")]))).code).toBe("invalid-zip");
    const good = zipFile("good.zip", {
      "a/Streaming_History_Audio_1.json": extRows(400, Date.UTC(2020, 0, 1), "A"),
      "a/Streaming_History_Audio_2.json": extRows(400, Date.UTC(2021, 0, 1), "B"),
    }, 0);
    const bytes = new Uint8Array(await good.slice(0, good.size).arrayBuffer());
    const cut = memFile("cut.zip", bytes.slice(0, Math.floor(bytes.length * 0.4)));
    expect((await failure(run([cut]))).code).toBe("invalid-zip");
    const emptyZip = memFile("empty.zip", new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...new Array(18).fill(0)]));
    expect((await failure(run([emptyZip]))).code).toBe("invalid-zip");
  });

  it("invalid-json: a history file that is not valid JSON, or not an array", async () => {
    const broken = await failure(run([memFile("StreamingHistory_music_0.json", "[{ not json")]));
    expect(broken.code).toBe("invalid-json");
    expect(broken.summary?.files[0]!.structure).toMatchObject({ topLevel: "invalid-json" });
    const inZip = await failure(run([zipFile("a.zip", { "Streaming_History_Audio_1.json": "{broken" })]));
    expect(inZip.code).toBe("invalid-json");
    const notArray = await failure(run([memFile("endsong_0.json", json({ a: 1 }))]));
    expect(notArray.code).toBe("invalid-json");
    const unknownBroken = await failure(run([memFile("whatever.json", "nope")]));
    expect(unknownBroken.code).toBe("invalid-json");
  });

  it("out-of-memory: allocation failure while reading, and a file past the size cap", async () => {
    const failing: InputFile = {
      name: "StreamingHistory_music_0.json", size: 10,
      slice: () => ({ arrayBuffer: () => Promise.reject(new RangeError("Array buffer allocation failed")) }),
    };
    expect((await failure(run([failing]))).code).toBe("out-of-memory");
    const big = memFile("Streaming_History_Audio_1.json", json(extRows(200, Date.UTC(2020, 0, 1), "Big")));
    expect((await failure(run([big], { maxEntryBytes: 1000 }))).code).toBe("out-of-memory");
    const zipped = zipFile("big.zip", { "d/Streaming_History_Audio_1.json": extRows(200, Date.UTC(2020, 0, 1), "Big") });
    expect((await failure(run([zipped], { maxEntryBytes: 1000 }))).code).toBe("out-of-memory");
  });

  it("cancelled: an aborted signal stops the run", async () => {
    const ac = new AbortController();
    const seen: number[] = [];
    const p = run([fullZip()], { chunkBytes: 64, signal: ac.signal, onProgress: (x) => { seen.push(x.bytesDone); if (seen.length === 3) ac.abort(); } });
    expect((await failure(p)).code).toBe("cancelled");
    expect(seen.length).toBe(3);
  });
});

describe("progress throttle", () => {
  it("lets at most 10 messages through per second", () => {
    let t = 0;
    const sent: number[] = [];
    const send = throttleProgress((p) => sent.push(p.bytesDone), () => t);
    for (t = 0; t < 3000; t++) send({ filesDone: 0, filesTotal: 1, currentFile: "f", bytesDone: t, bytesTotal: 3000 });
    expect(sent.length).toBeLessThanOrEqual(30);
    expect(sent.length).toBeGreaterThan(10);
    for (let s = 0; s < 3; s++) {
      expect(sent.filter((b) => b >= s * 1000 && b < (s + 1) * 1000).length).toBeLessThanOrEqual(10);
    }
  });
});

describe("worker handler (protocol)", () => {
  it("posts progress, then done with only a summary and an aggregate bundle: no Play objects", async () => {
    const posted: FromWorker[] = [];
    let t = 0;
    const handle = createWorkerHandler((m) => posted.push(m), {
      now: () => (t += 200),
    });
    await handle({ type: "load", jobId: "j1", files: [fullZip() as unknown as File], tz: TZ });
    const last = posted[posted.length - 1]!;
    expect(last.type).toBe("done");
    expect(posted.filter((m) => m.type === "progress").length).toBeGreaterThan(0);
    for (const m of posted) expect(m.jobId).toBe("j1");
    if (last.type !== "done") throw new Error("unreachable");
    expect(last.summary.totalPlays).toBe(6);
    expect(last.stats).toMatchObject({ version: 1, tz: TZ, sample: false, years: {}, sources: ["account", "extended"] });
    expect(Object.keys(last).sort()).toEqual(["jobId", "stats", "summary", "type"]);

    // everything posted must survive structured clone and carry no play data
    for (const m of posted) structuredClone(m);
    const text = JSON.stringify(posted);
    for (const needle of ["endMs", "Test Artist A", "Song One", "Ext Artist", "Ext Song", "Ext Show", CANARY, "msPlayed", "\"album\""]) {
      expect(text).not.toContain(needle);
    }
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v !== null && typeof v === "object") {
        const keys = Object.keys(v);
        expect(keys.includes("endMs") && keys.includes("track")).toBe(false);
        Object.values(v).forEach(walk);
      }
    };
    walk(posted);
  });

  it("limits progress messages to 10 per second", async () => {
    const posted: FromWorker[] = [];
    let t = 0;
    const handle = createWorkerHandler((m) => posted.push(m), { now: () => (t += 1) });   // 1 ms per call
    const files = Array.from({ length: 150 }, (_, i) =>
      memFile(`StreamingHistory_music_${i}.json`, json([{ endTime: "2023-01-01 10:00", artistName: `A${i}`, trackName: "T", msPlayed: 1000 }])) as unknown as File);
    await handle({ type: "load", jobId: "j", files, tz: TZ });
    const progress = posted.filter((m) => m.type === "progress");
    expect(t).toBeGreaterThan(300);                    // far more progress ticks than messages
    expect(progress.length).toBeLessThanOrEqual(Math.ceil(t / 100));
    expect(progress.length).toBeGreaterThan(1);
  });

  it("posts error with the code and a summary for bad input", async () => {
    const posted: FromWorker[] = [];
    const handle = createWorkerHandler((m) => posted.push(m));
    await handle({ type: "load", jobId: "e1", files: [memFile("a.zip", "garbage") as unknown as File], tz: TZ });
    const last = posted[posted.length - 1]!;
    expect(last).toMatchObject({ type: "error", jobId: "e1", code: "invalid-zip" });
  });

  it("cancel aborts the running job and posts cancelled, never done", async () => {
    const posted: FromWorker[] = [];
    const ref: { handle?: ReturnType<typeof createWorkerHandler> } = {};
    const slow = {
      name: "StreamingHistory_music_0.json", size: 3_000_000,
      slice: () => ({
        arrayBuffer: async () => {
          void ref.handle?.({ type: "cancel", jobId: "c1" });
          return new ArrayBuffer(1_000_000);
        },
      }),
    } as unknown as File;
    const handle = createWorkerHandler((m) => posted.push(m));
    ref.handle = handle;
    await handle({ type: "load", jobId: "c1", files: [slow], tz: TZ });
    expect(posted.map((m) => m.type)).not.toContain("done");
    expect(posted[posted.length - 1]).toMatchObject({ type: "cancelled", jobId: "c1" });
  });

  it("loadSample reports an error until the sample generator exists", async () => {
    const posted: FromWorker[] = [];
    await createWorkerHandler((m) => posted.push(m))({ type: "loadSample", jobId: "s", seed: 1, tz: TZ });
    expect(posted[0]).toMatchObject({ type: "error", jobId: "s", summary: null });
  });
});

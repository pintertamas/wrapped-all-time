import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { accountMusic, accountPodcast, extendedAudio } from "./__fixtures__";
import { memFile, zipFile } from "./__fixtures__/files";
import { createWorkerHandler, runPipeline } from "./pipeline";
import type { FromWorker } from "./protocol";

// No-network guard (F04): the import pipeline must never call anything that can send data.
describe("no-network guard", () => {
  const calls: string[] = [];
  const spy = (name: string) => () => { calls.push(name); };
  let imageSrc: PropertyDescriptor | undefined;
  let beacon: PropertyDescriptor | undefined;

  beforeEach(() => {
    calls.length = 0;
    vi.stubGlobal("fetch", vi.fn(spy("fetch")));
    class XHR { constructor() { calls.push("XMLHttpRequest"); } open() { calls.push("XMLHttpRequest.open"); } send() { calls.push("XMLHttpRequest.send"); } }
    vi.stubGlobal("XMLHttpRequest", XHR);
    class WS { constructor() { calls.push("WebSocket"); } }
    vi.stubGlobal("WebSocket", WS);
    class ES { constructor() { calls.push("EventSource"); } }
    vi.stubGlobal("EventSource", ES);
    beacon = Object.getOwnPropertyDescriptor(navigator, "sendBeacon");
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: spy("sendBeacon") });
    imageSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      configurable: true,
      get: () => "",
      set: () => { calls.push("Image.src"); },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (beacon) Object.defineProperty(navigator, "sendBeacon", beacon);
    else delete (navigator as unknown as Record<string, unknown>)["sendBeacon"];
    if (imageSrc) Object.defineProperty(HTMLImageElement.prototype, "src", imageSrc);
  });

  it("the stubs really count (sanity check)", () => {
    void fetch("https://example.invalid");
    new XMLHttpRequest();
    new WebSocket("wss://example.invalid");
    new EventSource("https://example.invalid");
    navigator.sendBeacon("https://example.invalid");
    new Image().src = "https://example.invalid/x.png";
    expect(calls).toEqual(["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "sendBeacon", "Image.src"]);
  });

  it("runs the pipeline and the worker handler on a fixture ZIP with zero calls", async () => {
    const zip = zipFile("my_spotify_data.zip", {
      "Spotify Account Data/StreamingHistory_music_0.json": accountMusic,
      "Spotify Account Data/StreamingHistory_podcast_0.json": accountPodcast,
      "Spotify Extended Streaming History/Streaming_History_Audio_2022_0.json": extendedAudio,
    });
    const loose = memFile("StreamingHistory_music_1.json", JSON.stringify(accountMusic.slice(0, 1)));
    const { summary } = await runPipeline([zip, loose], { tz: "Europe/Budapest" });
    expect(summary.totalPlays).toBeGreaterThan(0);

    const posted: FromWorker[] = [];
    await createWorkerHandler((m) => posted.push(m))({ type: "load", jobId: "n", files: [zip as unknown as File], tz: "UTC" });
    expect(posted[posted.length - 1]!.type).toBe("done");
    // and a failing import
    await createWorkerHandler((m) => posted.push(m))({ type: "load", jobId: "m", files: [memFile("bad.zip", "x") as unknown as File], tz: "UTC" });

    expect(calls).toEqual([]);
  });
});

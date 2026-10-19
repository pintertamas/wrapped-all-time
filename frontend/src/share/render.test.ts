import { describe, expect, it } from "vitest";
import type { PeriodStats } from "../model/types";
import { buildAltText } from "./altText";
import { renderShareCard, shareFileName, slugify } from "./render";
import type { CardCanvas, RenderOptions } from "./types";

function stats(over: Partial<PeriodStats> = {}): PeriodStats {
  return {
    from: "2025-01-01", to: "2025-12-31", minutes: 12345, plays: 678, podcastMinutes: 0,
    topArtists: [{ name: "Aurora Lane", minutes: 100, plays: 10 }, { name: "B", minutes: 9, plays: 1 }, { name: "C", minutes: 8, plays: 1 }],
    topTracks: [{ name: "Night Drive", artist: "Aurora Lane", minutes: 50, plays: 5 }],
    topAlbums: null, topDay: null, longestStreakDays: 0, activeDays: 0, firstTrack: null, skipRate: null,
    hourMinutes: new Array(24).fill(0), ...over,
  };
}

interface Recorded { texts: string[]; fonts: string[]; widths: number[]; scale: number[]; size: [number, number] }

/** Recording 2D context: text width = 0.5 * font size per character. */
function mockCanvas(rec: Recorded): (w: number, h: number) => CardCanvas {
  return (w, h) => {
    rec.size = [w, h];
    const ctx = {
      font: "10px x", fillStyle: "", textAlign: "", textBaseline: "",
      fillRect() {},
      scale(x: number) { rec.scale.push(x); },
      fillText(t: string) { rec.texts.push(t); rec.fonts.push(this.font); },
      measureText(t: string) {
        const size = Number(/(\d+)px/.exec(this.font)?.[1] ?? 10);
        const width = t.length * size * 0.5;
        rec.widths.push(width);
        return { width };
      },
    };
    return {
      width: w, height: h,
      getContext: () => ctx as unknown as CanvasRenderingContext2D,
      toBlob: (cb) => cb(new Blob(["png"], { type: "image/png" })),
    };
  };
}

async function render(over: Partial<RenderOptions> = {}) {
  const rec: Recorded = { texts: [], fonts: [], widths: [], scale: [], size: [0, 0] };
  const card = await renderShareCard({
    stats: stats(), period: "12m", periodLabel: "Last 12 months", format: "story", hd: false,
    paid: false, sample: false, productName: "Listening Vault", host: "example.test",
    createCanvas: mockCanvas(rec), ...over,
  });
  return { card, rec };
}

describe("share card renderer", () => {
  it("renders story and square at 1x and paid HD at 2x", async () => {
    expect((await render()).rec.size).toEqual([1080, 1920]);
    expect((await render({ format: "square" })).rec.size).toEqual([1080, 1080]);
    const hdStory = await render({ hd: true, paid: true });
    expect(hdStory.rec.size).toEqual([2160, 3840]);
    expect(hdStory.rec.scale).toEqual([2]);
    expect((await render({ hd: true, paid: true, format: "square" })).rec.size).toEqual([2160, 2160]);
    expect((await render({ hd: true, paid: false })).rec.size).toEqual([1080, 1920]);
  });

  it.each(["story", "square"] as const)("free %s card has the watermark and disclaimer", async (format) => {
    const { rec } = await render({ format });
    expect(rec.texts).toContain("made with Listening Vault · example.test");
    expect(rec.texts).toContain("Not affiliated with Spotify");
    expect(rec.texts).not.toContain("SAMPLE DATA");
  });

  it.each(["story", "square"] as const)("paid %s card has no watermark but keeps the disclaimer", async (format) => {
    const { rec } = await render({ format, paid: true });
    expect(rec.texts.some((t) => t.startsWith("made with"))).toBe(false);
    expect(rec.texts).toContain("Not affiliated with Spotify");
  });

  it.each(["story", "square"] as const)("sample %s card shows SAMPLE DATA", async (format) => {
    const { rec } = await render({ format, sample: true, paid: true });
    expect(rec.texts).toContain("SAMPLE DATA");
  });

  it("fits or truncates long names", async () => {
    const long = "A".repeat(200);
    const { rec } = await render({
      stats: stats({ topArtists: [{ name: long, minutes: 1, plays: 1 }] }),
    });
    const drawn = rec.texts.find((t) => t.includes("AAAA"))!;
    expect(drawn.endsWith("…")).toBe(true);
    expect(drawn.length).toBeLessThan(long.length);
    const size = Number(/(\d+)px/.exec(rec.fonts[rec.texts.indexOf(drawn)])?.[1]);
    expect(drawn.length * size * 0.5).toBeLessThanOrEqual(1080 - 160);
  });

  it("names the file <slug>-<period>-<format>.png", async () => {
    expect((await render()).card.fileName).toBe("listening-vault-12m-story.png");
    expect((await render({ format: "square", period: "2024" })).card.fileName).toBe("listening-vault-2024-square.png");
    expect(shareFileName("Näme  Here!", "all", "square")).toBe("name-here-all-square.png");
    expect(slugify("!!!")).toBe("card");
  });

  it("builds alt text from the data", async () => {
    const { card } = await render({ sample: true });
    expect(card.altText).toBe(buildAltText(stats(), "Last 12 months", true));
    expect(card.altText).toContain("12,345 minutes across 678 plays");
    expect(card.altText).toContain("Top artists: Aurora Lane, B, C.");
    expect(card.altText).toContain("Top track: Night Drive by Aurora Lane.");
    expect(card.altText).toContain("sample data");
    expect(buildAltText(stats({ topArtists: [], topTracks: [] }), "All time")).not.toContain("Top");
  });
});

describe("poster", () => {
  it("renders 2700x3600 (under 16.7 MP) with the disclaimer and no watermark", async () => {
    const { card, rec } = await render({ format: "poster", paid: true, hd: true });
    expect(rec.size).toEqual([2700, 3600]);
    expect(card.width * card.height).toBeLessThan(16_700_000);
    expect(rec.scale).toEqual([2.5]);
    expect(rec.texts).toContain("Not affiliated with Spotify");
    expect(rec.texts.some((t) => t.startsWith("made with"))).toBe(false);
    expect(rec.texts).toContain("1  Aurora Lane");
  });
  it("refuses locked users", async () => {
    await expect(render({ format: "poster", paid: false })).rejects.toThrow();
  });
});

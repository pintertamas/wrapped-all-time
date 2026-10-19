// Share card renderer: story 1080x1920 and square 1080x1080, paid HD at 2x. Lazy chunk, canvas only.
import fontUrl from "@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2?url";
import { config } from "../config";
import { buildAltText } from "./altText";
import { drawPoster } from "./layouts/poster";
import { drawSquare } from "./layouts/square";
import { drawStory } from "./layouts/story";
import {
  LOGICAL_HEIGHT, LOGICAL_WIDTH, MAX_CANVAS_PIXELS, POSTER_SCALE, type CardCanvas, type CardData, type RenderOptions, type RenderedCard,
} from "./types";

export function slugify(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "card";
}

/** <slug>-<period>-<story|square>.png */
export function shareFileName(productName: string, period: string, format: string): string {
  return `${slugify(productName)}-${slugify(period)}-${format}.png`;
}

let fontPromise: Promise<void> | null = null;

/** Loads the self-hosted Space Grotesk 700 once; falls back to system-ui when unavailable. */
export function ensureFont(): Promise<void> {
  if (fontPromise) return fontPromise;
  fontPromise = (async () => {
    try {
      if (typeof FontFace === "undefined" || typeof document === "undefined") return;
      const face = new FontFace("Space Grotesk", `url(${fontUrl})`, { weight: "700" });
      document.fonts.add(await face.load());
    } catch {
      /* system font fallback */
    }
  })();
  return fontPromise;
}

function domCanvas(width: number, height: number): CardCanvas {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function cardData(options: RenderOptions): CardData {
  const { stats } = options;
  return {
    periodLabel: options.periodLabel,
    minutes: stats.minutes,
    plays: stats.plays,
    topArtists: stats.topArtists.slice(0, 5).map((a) => a.name),
    topTracks: stats.topTracks.slice(0, 3).map((t) => ({ track: t.name, artist: t.artist })),
    productName: options.productName ?? config.productName,
    host: options.host ?? new URL(config.siteUrl).host,
    paid: options.paid,
    sample: options.sample,
  };
}

export async function renderShareCard(options: RenderOptions): Promise<RenderedCard> {
  await ensureFont();
  const poster = options.format === "poster";
  if (poster && !options.paid) throw new Error("Poster export requires the unlock");
  const scale = poster ? POSTER_SCALE : options.hd && options.paid ? 2 : 1;
  const width = LOGICAL_WIDTH;
  const height = LOGICAL_HEIGHT[options.format];
  if (width * scale * height * scale > MAX_CANVAS_PIXELS) throw new Error("Canvas too large");
  const canvas = (options.createCanvas ?? domCanvas)(width * scale, height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available");
  ctx.scale(scale, scale);
  const data = cardData(options);
  ({ story: drawStory, square: drawSquare, poster: drawPoster })[options.format](ctx, data, width, height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the card"))), "image/png"),
  );
  return {
    blob,
    fileName: shareFileName(data.productName, options.period, options.format),
    altText: buildAltText(options.stats, options.periodLabel, options.sample),
    width: width * scale,
    height: height * scale,
  };
}

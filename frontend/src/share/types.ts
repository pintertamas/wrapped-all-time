import type { PeriodStats } from "../model/types";

export type CardFormat = "story" | "square" | "poster";

/** Everything a layout needs, already reduced to plain strings and numbers. */
export interface CardData {
  periodLabel: string;
  minutes: number;
  plays: number;
  topArtists: string[];
  topTracks: { track: string; artist: string }[];
  productName: string;
  host: string;
  /** Paid cards carry no "made with" watermark. */
  paid: boolean;
  sample: boolean;
}

export interface RenderOptions {
  stats: PeriodStats;
  /** Route period key: 4w, 6m, 12m, YYYY or all. Used in the file name. */
  period: string;
  periodLabel: string;
  format: CardFormat;
  /** Paid HD: render at 2x. */
  hd: boolean;
  paid: boolean;
  sample: boolean;
  productName?: string;
  host?: string;
  /** Test seam; defaults to a DOM canvas. */
  createCanvas?: (width: number, height: number) => CardCanvas;
}

export interface CardCanvas {
  width: number;
  height: number;
  getContext(type: "2d"): CanvasRenderingContext2D | null;
  toBlob(cb: (blob: Blob | null) => void, type?: string): void;
}

export interface RenderedCard {
  blob: Blob;
  fileName: string;
  altText: string;
  width: number;
  height: number;
}

export const LOGICAL_WIDTH = 1080;
export const LOGICAL_HEIGHT: Record<CardFormat, number> = { story: 1920, square: 1080, poster: 1440 };
/** Poster print scale: 1080x1440 logical -> 2700x3600 px (18x24 in at 150 dpi, 9.72 MP). */
export const POSTER_SCALE = 2.5;
/** Canvas pixel limit to stay under (iOS Safari: 16.7 MP). */
export const MAX_CANVAS_PIXELS = 16_700_000;
export const FONT_FAMILY = '"Space Grotesk", system-ui, sans-serif';

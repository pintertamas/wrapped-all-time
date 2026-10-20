import type { CardData } from "../types";
import { COLORS, background, fitText, footer, formatNumber } from "./common";

const PAD = 96;

/** Print poster, 1080x1440 logical (rendered at 2.5x). Paid only, so no watermark. */
export function drawPoster(ctx: CanvasRenderingContext2D, card: CardData, width: number, height: number): void {
  const inner = width - PAD * 2;
  background(ctx, width, height);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = COLORS.muted;
  fitText(ctx, card.periodLabel.toUpperCase(), PAD, 180, inner, 44);
  ctx.fillStyle = COLORS.fg;
  fitText(ctx, formatNumber(card.minutes), PAD, 420, inner, 220);
  ctx.fillStyle = COLORS.muted;
  fitText(ctx, `minutes · ${formatNumber(card.plays)} plays`, PAD, 490, inner, 44);

  ctx.fillStyle = COLORS.accent;
  fitText(ctx, "TOP ARTISTS", PAD, 620, inner, 34);
  card.topArtists.slice(0, 5).forEach((name, i) => {
    ctx.fillStyle = COLORS.fg;
    fitText(ctx, `${i + 1}  ${name}`, PAD, 700 + i * 76, inner, 54, 30);
  });

  ctx.fillStyle = COLORS.accent;
  fitText(ctx, "TOP TRACKS", PAD, 1130, inner, 34);
  card.topTracks.slice(0, 3).forEach((t, i) => {
    ctx.fillStyle = COLORS.fg;
    fitText(ctx, `${i + 1}  ${t.track} · ${t.artist}`, PAD, 1190 + i * 52, inner, 38, 24);
  });

  footer(ctx, card, width, height, 56);
}

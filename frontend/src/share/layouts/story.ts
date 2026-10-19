import type { CardData } from "../types";
import { COLORS, background, fitText, footer, formatNumber } from "./common";

const PAD = 80;

export function drawStory(ctx: CanvasRenderingContext2D, card: CardData, width: number, height: number): void {
  const inner = width - PAD * 2;
  background(ctx, width, height);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = COLORS.muted;
  fitText(ctx, card.periodLabel.toUpperCase(), PAD, 200, inner, 40);
  ctx.fillStyle = COLORS.fg;
  fitText(ctx, formatNumber(card.minutes), PAD, 420, inner, 200);
  ctx.fillStyle = COLORS.muted;
  fitText(ctx, `minutes · ${formatNumber(card.plays)} plays`, PAD, 490, inner, 44);

  ctx.fillStyle = COLORS.accent;
  fitText(ctx, "TOP ARTISTS", PAD, 680, inner, 36);
  card.topArtists.slice(0, 5).forEach((name, i) => {
    ctx.fillStyle = COLORS.fg;
    fitText(ctx, `${i + 1}  ${name}`, PAD, 770 + i * 90, inner, 56, 32);
  });

  ctx.fillStyle = COLORS.accent;
  fitText(ctx, "TOP TRACKS", PAD, 1290, inner, 36);
  card.topTracks.slice(0, 3).forEach((t, i) => {
    ctx.fillStyle = COLORS.fg;
    fitText(ctx, `${i + 1}  ${t.track}`, PAD, 1370 + i * 110, inner, 48, 28);
    ctx.fillStyle = COLORS.muted;
    fitText(ctx, t.artist, PAD + 48, 1412 + i * 110, inner - 48, 30, 22);
  });

  footer(ctx, card, width, height, PAD);
}

import type { CardData } from "../types";
import { COLORS, background, fitText, footer, formatNumber } from "./common";

const PAD = 72;

export function drawSquare(ctx: CanvasRenderingContext2D, card: CardData, width: number, height: number): void {
  const inner = width - PAD * 2;
  background(ctx, width, height);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = COLORS.muted;
  fitText(ctx, card.periodLabel.toUpperCase(), PAD, 140, inner, 36);
  ctx.fillStyle = COLORS.fg;
  fitText(ctx, formatNumber(card.minutes), PAD, 320, inner, 160);
  ctx.fillStyle = COLORS.muted;
  fitText(ctx, `minutes · ${formatNumber(card.plays)} plays`, PAD, 380, inner, 38);

  ctx.fillStyle = COLORS.accent;
  fitText(ctx, "TOP ARTISTS", PAD, 500, inner, 32);
  card.topArtists.slice(0, 3).forEach((name, i) => {
    ctx.fillStyle = COLORS.fg;
    fitText(ctx, `${i + 1}  ${name}`, PAD, 575 + i * 72, inner, 50, 30);
  });

  footer(ctx, card, width, height, PAD);
}

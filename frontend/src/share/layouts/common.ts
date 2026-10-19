import { FONT_FAMILY, type CardData } from "../types";

export const COLORS = { bg: "#0f1115", fg: "#f4f1ea", muted: "#a9a59b", accent: "#7ee0a1" };

type Ctx = CanvasRenderingContext2D;

export function setFont(ctx: Ctx, size: number): void {
  ctx.font = `700 ${Math.round(size)}px ${FONT_FAMILY}`;
}

/**
 * Draws `text` on one line within `maxWidth`: shrinks the font down to `minSize`, then
 * truncates with an ellipsis. Returns the text actually drawn.
 */
export function fitText(
  ctx: Ctx, text: string, x: number, y: number, maxWidth: number, size: number, minSize = size * 0.6,
): string {
  let current = size;
  setFont(ctx, current);
  while (current > minSize && ctx.measureText(text).width > maxWidth) {
    current = Math.max(minSize, current - 2);
    setFont(ctx, current);
  }
  let out = text;
  if (ctx.measureText(out).width > maxWidth) {
    while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
    out = `${out.trimEnd()}…`;
  }
  ctx.fillText(out, x, y);
  return out;
}

export function background(ctx: Ctx, width: number, height: number): void {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = COLORS.accent;
  ctx.fillRect(0, 0, width, 16);
}

export const watermarkText = (card: CardData): string => `made with ${card.productName} · ${card.host}`;

/** Bottom block: SAMPLE DATA (sample only), watermark (free only), disclaimer (always). */
export function footer(ctx: Ctx, card: CardData, width: number, height: number, pad: number): void {
  const inner = width - pad * 2;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  let y = height - pad;
  ctx.fillStyle = COLORS.muted;
  fitText(ctx, "Not affiliated with Spotify", pad, y, inner, 28);
  if (!card.paid) {
    y -= 44;
    ctx.fillStyle = COLORS.fg;
    fitText(ctx, watermarkText(card), pad, y, inner, 32);
  }
  if (card.sample) {
    y -= 64;
    ctx.fillStyle = COLORS.accent;
    fitText(ctx, "SAMPLE DATA", pad, y, inner, 44);
  }
}

export const formatNumber = (n: number): string => new Intl.NumberFormat("en-US").format(n);

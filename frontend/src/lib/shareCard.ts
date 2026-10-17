import type { Recap } from "./recap";

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;

type Ctx = CanvasRenderingContext2D;

/** Shrink text with an ellipsis until it fits maxWidth. */
function fit(ctx: Ctx, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

/** Draws the share card. Pure canvas drawing: no images, no fonts, no network. */
export function drawShareCard(ctx: Ctx, r: Recap, title: string): void {
  const pad = 90;
  const maxW = CARD_WIDTH - pad * 2;
  const grad = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT);
  grad.addColorStop(0, "#2b1b4d");
  grad.addColorStop(1, "#14111f");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#f2effa";
  ctx.font = "bold 84px system-ui, sans-serif";
  ctx.fillText(fit(ctx, title, maxW), pad, 220);

  let y = 360;
  const section = (heading: string, rows: { primary: string; secondary?: string }[]) => {
    ctx.fillStyle = "#ffd23f";
    ctx.font = "bold 48px system-ui, sans-serif";
    ctx.fillText(heading, pad, y);
    y += 40;
    rows.forEach((row, i) => {
      y += 90;
      ctx.fillStyle = "#f2effa";
      ctx.font = "bold 56px system-ui, sans-serif";
      ctx.fillText(fit(ctx, `${i + 1}. ${row.primary}`, maxW), pad, y);
      if (row.secondary) {
        y += 50;
        ctx.fillStyle = "#b3acc9";
        ctx.font = "36px system-ui, sans-serif";
        ctx.fillText(fit(ctx, row.secondary, maxW), pad + 60, y);
      }
    });
    y += 110;
  };
  section("Top artists", r.topArtists.slice(0, 5).map((a) => ({ primary: a.name })));
  section(
    "Top tracks",
    r.topTracks.slice(0, 3).map((t) => ({ primary: t.name, secondary: t.artists.map((a) => a.name).join(", ") })),
  );

  // DEMO watermark, diagonal across the card.
  ctx.save();
  ctx.translate(CARD_WIDTH / 2, CARD_HEIGHT / 2);
  ctx.rotate(-Math.PI / 6);
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#ffd23f";
  ctx.font = "bold 360px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("DEMO", 0, 0);
  ctx.restore();

  ctx.fillStyle = "#b3acc9";
  ctx.font = "34px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("DEMO - sample data, not connected to Spotify", CARD_WIDTH / 2, CARD_HEIGHT - 80);
}

/** Renders the card to a PNG data URL, or null when canvas is unavailable. */
export function renderShareCard(r: Recap, title: string): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  drawShareCard(ctx, r, title);
  return canvas.toDataURL("image/png");
}

import { useEffect, useState } from "react";
import type { PeriodStats } from "../model/types";
import { routeToHash } from "../router";
import { loadShareRenderer } from "./lazy";
import type { CardFormat, RenderOptions, RenderedCard } from "./types";

export type RenderCard = (options: RenderOptions) => Promise<RenderedCard>;

interface Props {
  stats: PeriodStats;
  period: string;
  periodLabel: string;
  sample: boolean;
  /** Unlocked: HD cards without watermark. */
  paid: boolean;
  onClose: () => void;
  /** Test seam; defaults to the lazy renderer. */
  renderCard?: RenderCard;
}

const FORMATS: CardFormat[] = ["story", "square"];
const POSTER_SIZE = "Print size 2700x3600 px (18x24 in at 150 dpi)";
const defaultRender: RenderCard = async (o) => (await loadShareRenderer()).renderShareCard(o);

export function canShareFiles(file: File): boolean {
  return typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
}

function download(card: RenderedCard): string {
  const url = URL.createObjectURL(card.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = card.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return url;
}

export default function ShareSheet({ stats, period, periodLabel, sample, paid, onClose, renderCard = defaultRender }: Props) {
  const [hd, setHd] = useState(false);
  const [cards, setCards] = useState<Partial<Record<CardFormat, RenderedCard>>>({});
  const [urls, setUrls] = useState<Partial<Record<CardFormat, string>>>({});
  const [hint, setHint] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const made: string[] = [];
    Promise.all(
      FORMATS.map((format) => renderCard({ stats, period, periodLabel, format, hd: hd && paid, paid, sample })),
    )
      .then((rendered) => {
        if (cancelled) return;
        const nextCards: Partial<Record<CardFormat, RenderedCard>> = {};
        const nextUrls: Partial<Record<CardFormat, string>> = {};
        FORMATS.forEach((f, i) => {
          nextCards[f] = rendered[i];
          const u = typeof URL.createObjectURL === "function" ? URL.createObjectURL(rendered[i].blob) : "";
          if (u) made.push(u);
          nextUrls[f] = u;
        });
        setError(false);
        setCards(nextCards);
        setUrls(nextUrls);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
      made.forEach((u) => URL.revokeObjectURL?.(u));
    };
  }, [stats, period, periodLabel, sample, paid, hd, renderCard]);

  async function share(format: CardFormat) {
    const card = cards[format];
    if (!card) return;
    const file = new File([card.blob], card.fileName, { type: "image/png" });
    if (canShareFiles(file)) {
      setHint(false);
      try {
        await navigator.share({ files: [file], title: periodLabel });
      } catch {
        /* user dismissed the share dialog */
      }
      return;
    }
    const url = download(card);
    setHint(true);
    setTimeout(() => URL.revokeObjectURL?.(url), 1000);
  }

  async function exportPoster() {
    if (!paid) return;
    try {
      const card = await renderCard({ stats, period, periodLabel, format: "poster", hd: true, paid, sample });
      const url = download(card);
      setTimeout(() => URL.revokeObjectURL?.(url), 1000);
    } catch {
      setError(true);
    }
  }

  return (
    <section className="card" role="dialog" aria-label="Share your recap" data-testid="share-sheet">
      <h2>Share your recap</h2>
      {error && <p className="note" role="alert">Could not draw the cards. Try again.</p>}
      {FORMATS.map((format) => (
        <figure key={format} data-testid={`preview-${format}`}>
          {urls[format] ? (
            <img src={urls[format]} alt={cards[format]?.altText ?? ""} style={{ maxWidth: "100%", maxHeight: "24rem" }} />
          ) : (
            <p className="note">Drawing the {format} card...</p>
          )}
          <figcaption>{format === "story" ? "Story (1080x1920)" : "Square (1080x1080)"}</figcaption>
          <button type="button" className="btn btn-primary" disabled={!cards[format]} onClick={() => share(format)}>
            Share {format}
          </button>
        </figure>
      ))}
      {paid && (
        <label>
          <input type="checkbox" checked={hd} onChange={(e) => setHd(e.target.checked)} /> HD (2x, no watermark)
        </label>
      )}
      <div data-testid="poster-section">
        <h3>Print poster</h3>
        {paid ? (
          <>
            <p className="note">{POSTER_SIZE}.</p>
            <button type="button" className="btn" onClick={exportPoster}>Download poster PNG</button>
          </>
        ) : (
          <p className="note">
            A print-size poster comes with the unlock. <a href={routeToHash({ view: "unlock", code: null })}>Unlock the poster</a>
          </p>
        )}
      </div>
      {hint && (
        <p className="note" data-testid="share-hint">
          Saved to your downloads. If nothing downloaded, long-press the image above and choose Save image.
        </p>
      )}
      <button type="button" className="btn" onClick={onClose}>
        Close
      </button>
    </section>
  );
}

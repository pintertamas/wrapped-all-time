import { useState } from "react";
import type { Recap } from "../lib/recap";
import { renderShareCard } from "../lib/shareCard";

export default function ShareCardButton({ recap, title }: { recap: Recap; title: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const open = () => {
    const url = renderShareCard(recap, title);
    setFailed(url === null);
    setSrc(url);
  };
  const close = () => {
    setSrc(null);
    setFailed(false);
  };

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={open}>
        Share card
      </button>
      {failed && <p className="note" role="alert">Could not render the card in this browser.</p>}
      {src && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Share card">
          <div className="modal-body">
            <img src={src} alt="Share card preview (demo)" className="share-img" />
            <p className="note">Long-press the image to save it.</p>
            <div className="actions">
              <a className="btn btn-primary" href={src} download="recap-share-card-demo.png">
                Download
              </a>
              <button type="button" className="btn" onClick={close}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { useState } from "react";

const KEY = "wrapped-interest";

function readInterest(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export default function AllYearsTeaser() {
  const [open, setOpen] = useState(false);
  const [counted, setCounted] = useState(readInterest);

  const countMeIn = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* storage unavailable: still thank the user */
    }
    setCounted(true);
  };

  return (
    <section className="card">
      <button type="button" className="btn teaser" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <h2>All years (locked)</h2>
        <div className="hist teaser-chart" aria-hidden="true">
          {[30, 45, 38, 60, 52, 75, 68, 90, 80, 100].map((h, i) => (
            <span key={i} className="bar" style={{ height: `${h}%` }} />
          ))}
        </div>
        <p className="note">
          Spotify login covers about 12 months, your last 50 plays and no history before that. The lifetime view needs
          the Extended streaming history export (up to 30 days wait).
        </p>
      </button>
      {open && (
        <div role="dialog" aria-label="Unlock panel" className="teaser-panel">
          <h3>This is where the $4.99 unlock would sit</h3>
          {counted ? (
            <p>Thanks, we noted your interest!</p>
          ) : (
            <button type="button" className="btn btn-primary" onClick={countMeIn}>
              Count me in
            </button>
          )}
        </div>
      )}
    </section>
  );
}

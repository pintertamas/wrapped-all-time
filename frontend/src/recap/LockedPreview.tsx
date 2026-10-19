import { routeToHash } from "../router";

const unlockHref = routeToHash({ view: "unlock", code: null });

/** Locked years / All time: placeholder text only, never real values. */
export default function LockedPreview({ label }: { label: string }) {
  return (
    <section className="card" data-testid="locked">
      <h2>{label} is part of the full unlock</h2>
      <p className="note">Numbers: ••• minutes, ••• plays. Top artist: •••••. Unlock once for $4.99 to see every year and all time.</p>
      <a className="btn btn-primary" data-testid="teaser-unlock" href={unlockHref}>
        Unlock
      </a>
      <a className="btn" data-testid="teaser-hd" href={unlockHref}>
        HD cards without watermark (unlock)
      </a>
    </section>
  );
}

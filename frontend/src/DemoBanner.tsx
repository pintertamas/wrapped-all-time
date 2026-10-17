export const DEMO_BANNER_TEXT = "DEMO - not connected to Spotify";

/** Persistent banner: always visible at the top of every screen of the demo. */
export default function DemoBanner() {
  return (
    <div className="demo-banner" role="status" aria-live="polite" data-testid="demo-banner">
      {DEMO_BANNER_TEXT}
    </div>
  );
}

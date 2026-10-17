import { useState } from "react";
import DemoBanner from "./DemoBanner";
import { isConnected } from "./lib/session";
import Landing from "./pages/Landing";
import MockConsent from "./pages/MockConsent";

type View = "landing" | "consent" | "recap";

export default function App() {
  const [view, setView] = useState<View>(() => (isConnected() ? "recap" : "landing"));
  return (
    <>
      <DemoBanner />
      {view === "landing" && <Landing onConnect={() => setView("consent")} />}
      {view === "consent" && <MockConsent onApprove={() => setView("recap")} onCancel={() => setView("landing")} />}
      {/* Placeholder: T004 replaces this with the real recap page. */}
      {view === "recap" && (
        <main className="page" data-testid="recap-placeholder">
          <h1>Your recap</h1>
          <p className="note">Coming soon.</p>
        </main>
      )}
    </>
  );
}

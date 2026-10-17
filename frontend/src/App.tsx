import { useState } from "react";
import DemoBanner from "./DemoBanner";
import { clearConnected, isConnected } from "./lib/session";
import Landing from "./pages/Landing";
import MockConsent from "./pages/MockConsent";
import Recap from "./pages/Recap";

type View = "landing" | "consent" | "recap";

export default function App() {
  const [view, setView] = useState<View>(() => (isConnected() ? "recap" : "landing"));
  // Guard: the recap needs the demo session flag, otherwise show the landing page.
  const shown: View = view === "recap" && !isConnected() ? "landing" : view;
  return (
    <>
      <DemoBanner />
      {shown === "landing" && <Landing onConnect={() => setView("consent")} />}
      {shown === "consent" && <MockConsent onApprove={() => setView("recap")} onCancel={() => setView("landing")} />}
      {shown === "recap" && <Recap onLogout={() => { clearConnected(); setView("landing"); }} />}
    </>
  );
}

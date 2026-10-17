import { config } from "./config";
import ImportPage from "./pages/ImportPage";
import Landing from "./pages/Landing";
import RecapPage from "./recap/RecapPage";
import { routeToHash, useRoute } from "./router";
import UnlockSheet from "./unlock/UnlockSheet";

const page = (path: string) => `${config.basePath}${path}`;

export default function App() {
  const route = useRoute();

  return (
    <div className="shell">
      <header className="site-header">
        <a className="brand" href={routeToHash({ view: "landing" })}>
          {config.productName}
        </a>
      </header>
      {route.view === "landing" && <Landing />}
      {route.view === "import" && <ImportPage />}
      {route.view === "recap" && <RecapPage period={route.period} />}
      {route.view === "unlock" && <UnlockSheet code={route.code} />}
      <footer className="site-footer">
        <p className="note">Not affiliated with Spotify. Your files are read on this device and never uploaded.</p>
        <nav aria-label="Footer">
          <a href={page("guide/")}>Export guide</a>
          <a href={page("privacy/")}>Privacy</a>
          <a href={page("terms/")}>Terms</a>
          <a href={routeToHash({ view: "unlock", code: null })}>Restore purchase</a>
        </nav>
      </footer>
    </div>
  );
}

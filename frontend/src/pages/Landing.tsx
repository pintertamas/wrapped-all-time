import { config } from "../config";
import { routeToHash } from "../router";

export default function Landing() {
  return (
    <main className="page">
      <h1>{config.productName}</h1>
      <p className="lead">
        Your whole Spotify listening history: every year and all time, not just the last twelve months.
      </p>
      <p className="note">Load your Spotify data export. It is read on this device and never leaves it.</p>
      <div className="actions">
        <a className="btn btn-primary" href={routeToHash({ view: "import" })}>
          Load my data
        </a>
        <a className="btn" href={`${config.basePath}guide/`}>
          How to get your file
        </a>
      </div>
    </main>
  );
}

import { config } from "../config";

// Shell only: the drop zone, progress and summary arrive with the import tasks.
export default function ImportPage() {
  return (
    <main className="page" data-testid="import">
      <h1>Load your Spotify data</h1>
      <p className="lead">The importer is on its way. Your files will be read on this device only.</p>
      <p className="note">
        Don&apos;t have your file yet? <a href={`${config.basePath}guide/`}>See how to request it</a>.
      </p>
    </main>
  );
}

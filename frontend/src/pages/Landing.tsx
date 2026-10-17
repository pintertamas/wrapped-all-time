export default function Landing({ onConnect }: { onConnect: () => void }) {
  return (
    <main className="page">
      <h1>Wrapped Vault</h1>
      <p className="lead">
        See a recap of your listening, any time of year. This demo uses sample data only.
      </p>
      <p className="note">Unaffiliated with Spotify.</p>
      <button type="button" className="btn btn-primary" onClick={onConnect}>
        Connect Spotify (demo)
      </button>
    </main>
  );
}

import DemoBanner from "./DemoBanner";

export default function App() {
  return (
    <>
      <DemoBanner />
      <main className="page">
        <h1>Wrapped Vault</h1>
        <p className="lead">
          A static demo of a listening recap. All data is sample data; nothing leaves your device.
        </p>
        <p className="note">Unaffiliated with Spotify. The recap itself is coming in the next steps of this proof of concept.</p>
      </main>
    </>
  );
}

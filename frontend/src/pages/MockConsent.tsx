import { setConnected } from "../lib/session";

export const CONSENT_LABEL = "DEMO MOCK, no data leaves your device";
export const SCOPES = ["user-top-read", "user-read-recently-played"];

export default function MockConsent({ onApprove, onCancel }: { onApprove: () => void; onCancel: () => void }) {
  return (
    <main className="page">
      <p className="mock-label">{CONSENT_LABEL}</p>
      <h1>Wrapped Vault would like to access</h1>
      <ul className="scopes">
        {SCOPES.map((s) => (
          <li key={s}>
            <code>{s}</code>
          </li>
        ))}
      </ul>
      <div className="actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setConnected();
            onApprove();
          }}
        >
          Approve
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </main>
  );
}

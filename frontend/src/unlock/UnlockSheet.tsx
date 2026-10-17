import { config } from "../config";

// Shell only: checkout link, key field and restore arrive with the unlock tasks.
export default function UnlockSheet({ code }: { code: string | null }) {
  const available = config.unlockProvider !== "none" && config.checkoutUrl !== "";
  return (
    <main className="page" data-testid="unlock">
      <h1>Unlock every year</h1>
      <p className="lead">One-time unlock for every year and all time of your listening history.</p>
      {available ? (
        <p className="note">Checkout opens here soon.</p>
      ) : (
        <p className="note">Coming soon.</p>
      )}
      {code && <p className="note">Code received. Checking it arrives soon.</p>}
    </main>
  );
}

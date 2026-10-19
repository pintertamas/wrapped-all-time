import { useState, type FormEvent } from "react";
import { config } from "../config";
import { loadRecap } from "../storage/recap";
import { routeToHash } from "../router";
import { isUnlocked, readCodeFromHash, redeemKey, type RedeemResult } from "./entitlement";
import type { UnlockVerifier } from "./verifier";

type Failure = Exclude<RedeemResult, { ok: true }>["reason"];

export const FAILURE_MESSAGES: Record<Failure, string> = {
  invalid: "That key was not recognised. Check it for typos, or paste it again from your receipt email.",
  "wrong-product": "That key belongs to a different product, so it cannot unlock this one.",
  refunded: "That purchase was refunded or disabled, so the key no longer works.",
  offline: "Could not reach the payment provider. Check your connection and try again.",
  "provider-error": "The payment provider did not answer properly. Try again in a moment.",
  "storage-blocked": "Your browser blocked saving the unlock. Allow site storage for this page and try again.",
};

interface Props {
  code: string | null;
  /** Test seam; defaults to the configured provider's verifier. */
  verifier?: UnlockVerifier;
}

export default function UnlockSheet({ code, verifier }: Props) {
  const [key, setKey] = useState(() => readCodeFromHash() ?? code ?? "");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [done, setDone] = useState(() => isUnlocked());

  const checkout = config.checkoutUrl !== "" && config.unlockProvider !== "none";
  const stats = loadRecap();
  const accountOnly = !!stats && stats.sources.includes("account") && !stats.sources.includes("extended");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFailure(null);
    const result = await redeemKey(key, verifier);
    setBusy(false);
    if (result.ok) {
      setKey("");
      setDone(true);
    } else {
      setFailure(result.reason);
    }
  }

  return (
    <main className="page" data-testid="unlock">
      <h1>Unlock every year</h1>
      <p className="lead">
        One-time unlock for $4.99: every calendar year, all time, HD share cards without watermark and the poster.
      </p>
      {accountOnly && (
        <p className="note" role="note">
          Unlocking adds years only if you load the Extended history.
        </p>
      )}
      {done && (
        <p className="note" role="status">
          Unlocked on this device. <a href={routeToHash({ view: "recap", period: "all" })}>See your all time recap</a>
        </p>
      )}
      <section>
        <h2>1. Buy a key</h2>
        {checkout ? (
          <p>
            <a className="btn" href={config.checkoutUrl} target="_blank" rel="noopener noreferrer">
              Buy for $4.99
            </a>
          </p>
        ) : (
          <p className="note">Coming soon.</p>
        )}
      </section>
      <section>
        <h2>2. Enter your key</h2>
        <form onSubmit={submit}>
          <label htmlFor="unlock-key">License key</label>
          <input
            id="unlock-key"
            name="license-key"
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <button type="submit" className="btn" disabled={busy || key.trim() === ""}>
            {busy ? "Checking..." : "Unlock"}
          </button>
        </form>
        {failure && (
          <p className="note" role="alert">
            {FAILURE_MESSAGES[failure]}
          </p>
        )}
        {config.supportUrl !== "" && (
          <p className="note">
            <a href={config.supportUrl} target="_blank" rel="noopener noreferrer">
              Lost your key?
            </a>
          </p>
        )}
      </section>
      <p className="note">
        Honest notes: the key is checked once with the payment provider and only its last four characters are kept on
        this device. One key can be shared, and we trust you not to. Your listening files are never uploaded. Restore
        on a new device by entering the same key here.
      </p>
    </main>
  );
}

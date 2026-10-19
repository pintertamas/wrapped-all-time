import { UNLOCK_KEY } from "../storage/keys";
import { parseHash } from "../router";
import { config } from "../config";
import type { UnlockProvider } from "../configSchema";
import { normalizeKey } from "./key";
import { createVerifier, type UnlockVerifier, type VerifyResult } from "./verifier";

/** Honour-system unlock record: the only thing stored. Never the full key or the provider response. */
export interface UnlockRecord {
  v: 1;
  provider: Exclude<UnlockProvider, "none">;
  keyLast4: string;
  verifiedAt: string;
}

export type RedeemResult = VerifyResult | { ok: false; reason: "storage-blocked" };

/** Read-only check used by locked previews. Only the shape is checked. */
export function isUnlocked(): boolean {
  try {
    const raw = localStorage.getItem(UNLOCK_KEY);
    if (!raw) return false;
    const u = JSON.parse(raw) as { v?: number; keyLast4?: unknown } | null;
    return !!u && u.v === 1 && typeof u.keyLast4 === "string";
  } catch {
    return false;
  }
}

/** Persists the entitlement. Returns false when storage is unavailable. */
export function writeEntitlement(provider: UnlockRecord["provider"], key: string, now: Date = new Date()): boolean {
  const record: UnlockRecord = { v: 1, provider, keyLast4: key.slice(-4), verifiedAt: now.toISOString() };
  try {
    localStorage.setItem(UNLOCK_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

/**
 * Verifies a key with the configured provider and, on success, writes the entitlement.
 * The key lives only in this call: it is not stored, logged or returned.
 */
export async function redeemKey(
  rawKey: string,
  verifier: UnlockVerifier = createVerifier(),
  provider: UnlockProvider = config.unlockProvider,
): Promise<RedeemResult> {
  const key = normalizeKey(rawKey);
  if (key === null) return { ok: false, reason: "invalid" };
  const result = await verifier.verify(key);
  if (!result.ok) return result;
  if (provider === "none") return { ok: false, reason: "provider-error" };
  return writeEntitlement(provider, key) ? { ok: true } : { ok: false, reason: "storage-blocked" };
}

/**
 * Reads `#/unlock?code=<key>` and immediately strips the code from the address bar with
 * history.replaceState so it does not linger in the URL, history entry or a copied link.
 */
export function readCodeFromHash(): string | null {
  const route = parseHash(window.location.hash);
  if (route.view !== "unlock" || route.code === null) return null;
  try {
    const { pathname, search } = window.location;
    window.history.replaceState(window.history.state, "", `${pathname}${search}#/unlock`);
  } catch {
    // replaceState blocked: still return the code
  }
  return route.code;
}

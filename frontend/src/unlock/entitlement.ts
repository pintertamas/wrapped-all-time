import { UNLOCK_KEY } from "../storage/keys";

/** Honour-system unlock record. Read-only here; the unlock flow writes it. Only the shape is checked. */
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

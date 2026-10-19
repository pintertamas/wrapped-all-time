// Persistence of the recap (StatsBundle aggregates only; raw plays never leave the worker) and prefs.
// sessionStorage by default; localStorage when "Keep my recap on this device" is ticked.
import type { StatsBundle } from "../model/types";
import { PREFS_KEY, RECAP_KEY, UNLOCK_KEY } from "./keys";

export interface Prefs { v: 1; keepRecap: boolean }

function read(store: () => Storage, key: string): unknown {
  try {
    const raw = store().getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function write(store: () => Storage, key: string, value: unknown): void {
  try {
    store().setItem(key, JSON.stringify(value));
  } catch {
    // storage blocked or full: the recap simply is not remembered
  }
}

function remove(store: () => Storage, key: string): void {
  try {
    store().removeItem(key);
  } catch {
    // ignore
  }
}

const session = () => window.sessionStorage;
const local = () => window.localStorage;

export function loadPrefs(): Prefs {
  const p = read(local, PREFS_KEY) as Partial<Prefs> | null;
  return { v: 1, keepRecap: p?.v === 1 && p.keepRecap === true };
}

/** Saves prefs and moves a stored recap to the matching storage. */
export function savePrefs(prefs: Prefs): void {
  const existing = loadRecap();
  write(local, PREFS_KEY, prefs);
  if (existing) saveRecap(existing);
}

export function saveRecap(stats: StatsBundle): void {
  const keep = loadPrefs().keepRecap;
  const [to, from] = keep ? [local, session] : [session, local];
  write(to, RECAP_KEY, { v: 1, stats });
  remove(from, RECAP_KEY);
}

export function loadRecap(): StatsBundle | null {
  for (const store of [session, local]) {
    const r = read(store, RECAP_KEY) as { v?: number; stats?: StatsBundle } | null;
    if (r && r.v === 1 && r.stats && r.stats.version === 1) return r.stats;
  }
  return null;
}

/** Honour-system unlock record written by the unlock flow; shape only is checked here. */
export function isUnlocked(): boolean {
  const u = read(local, UNLOCK_KEY) as { v?: number; keyLast4?: unknown } | null;
  return !!u && u.v === 1 && typeof u.keyLast4 === "string";
}

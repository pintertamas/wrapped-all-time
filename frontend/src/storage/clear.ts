// "Clear everything": removes every lv.* key from both storages, terminates parse workers and goes home.
import { KEY_PREFIX } from "./keys";

const terminators = new Set<() => void>();

/** Register something that terminates a running worker; returns the unregister function. */
export function registerWorkerTerminator(fn: () => void): () => void {
  terminators.add(fn);
  return () => { terminators.delete(fn); };
}

function clearStore(get: () => Storage): void {
  try {
    const store = get();
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k !== null && k.startsWith(KEY_PREFIX)) keys.push(k);
    }
    for (const k of keys) store.removeItem(k);
  } catch {
    // storage blocked: nothing to clear
  }
}

export function clearEverything(): void {
  clearStore(() => window.localStorage);
  clearStore(() => window.sessionStorage);
  for (const t of [...terminators]) t();
  terminators.clear();
  window.location.hash = "#/";
}

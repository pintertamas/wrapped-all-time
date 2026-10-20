/** Longest key we will send; anything longer cannot be a real license key. */
export const MAX_KEY_LENGTH = 128;

/** Trims pasted whitespace. Returns null for an empty or oversized key (never sent to a provider). */
export function normalizeKey(key: string): string | null {
  const trimmed = key.trim();
  return trimmed === "" || trimmed.length > MAX_KEY_LENGTH ? null : trimmed;
}

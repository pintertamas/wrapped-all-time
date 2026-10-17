const KEY = "wrapped-vault-demo-session";

/** Demo "login" flag; lives only in this browser's localStorage. */
export function isConnected(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setConnected(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* storage blocked: the demo still routes to the recap for this visit */
  }
}

export function clearConnected(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

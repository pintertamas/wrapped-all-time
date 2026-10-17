// Hash router, no library. Views: #/, #/import, #/recap/<4w|6m|12m|YYYY|all>, #/unlock[?code=<key>].
import { useSyncExternalStore } from "react";

export type RecapPeriod = "4w" | "6m" | "12m" | "all" | `${number}`;

export type Route =
  | { view: "landing" }
  | { view: "import" }
  | { view: "recap"; period: RecapPeriod }
  | { view: "unlock"; code: string | null };

export const DEFAULT_PERIOD: RecapPeriod = "12m";
const MAX_CODE_LENGTH = 128;

export function isRecapPeriod(value: string): value is RecapPeriod {
  return value === "4w" || value === "6m" || value === "12m" || value === "all" || /^(19|20)\d{2}$/.test(value);
}

/** Parses location.hash. Anything unknown falls back to the landing view. */
export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, "");
  const [pathPart, query = ""] = raw.split("?", 2);
  const segments = pathPart.split("/").filter(Boolean);

  if (segments.length === 0) return { view: "landing" };
  const [first, second, ...rest] = segments;
  if (rest.length > 0) return { view: "landing" };

  if (first === "import" && second === undefined) return { view: "import" };
  if (first === "recap") {
    if (second === undefined) return { view: "recap", period: DEFAULT_PERIOD };
    return isRecapPeriod(second) ? { view: "recap", period: second } : { view: "landing" };
  }
  if (first === "unlock" && second === undefined) {
    const code = new URLSearchParams(query).get("code")?.trim() ?? "";
    return { view: "unlock", code: code === "" ? null : code.slice(0, MAX_CODE_LENGTH) };
  }
  return { view: "landing" };
}

export function routeToHash(route: Route): string {
  switch (route.view) {
    case "landing":
      return "#/";
    case "import":
      return "#/import";
    case "recap":
      return `#/recap/${route.period}`;
    case "unlock":
      return route.code ? `#/unlock?${new URLSearchParams({ code: route.code })}` : "#/unlock";
  }
}

export function navigate(route: Route): void {
  window.location.hash = routeToHash(route);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

const getHash = () => window.location.hash;

/** Current route; re-renders on hashchange. */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, () => "");
  return parseHash(hash);
}

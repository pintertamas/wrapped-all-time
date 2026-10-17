// Pure config parser, shared by the app (src/config.ts) and the build (vite.config.ts, CSP plugin).
// It never reads the Vite env object itself: src/config.ts is the only module that does.

export type UnlockProvider = "none" | "lemonsqueezy" | "gumroad";
export type AnalyticsProvider = "none" | "goatcounter";

export interface AppConfig {
  basePath: string;
  productName: string;
  siteUrl: string;
  robots: "index" | "noindex";
  envLabel: string;
  checkoutUrl: string;
  unlockProvider: UnlockProvider;
  unlockProductId: string;
  unlockStoreId: string;
  supportUrl: string;
  analyticsProvider: AnalyticsProvider;
  analyticsSite: string;
  featureLogin: boolean;
  spotifyClientId: string;
}

/** Defaults mirror the committed frontend/.env; used when a value is missing or empty. */
export const DEFAULTS: AppConfig = {
  basePath: "/",
  productName: "Listening Vault",
  siteUrl: "https://pintertamas.github.io/wrapped-all-time/",
  robots: "index",
  envLabel: "",
  checkoutUrl: "",
  unlockProvider: "none",
  unlockProductId: "",
  unlockStoreId: "",
  supportUrl: "",
  analyticsProvider: "none",
  analyticsSite: "",
  featureLogin: false,
  spotifyClientId: "",
};

type Env = Record<string, unknown>;

function str(env: Env, key: string, fallback: string): string {
  const value = env[key];
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed === "" ? fallback : trimmed;
}

function oneOf<T extends string>(env: Env, key: string, allowed: readonly T[], fallback: T): T {
  const value = str(env, key, fallback).toLowerCase();
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function parseConfig(env: Env): AppConfig {
  return {
    basePath: str(env, "BASE_URL", str(env, "VITE_BASE_PATH", DEFAULTS.basePath)),
    productName: str(env, "VITE_PRODUCT_NAME", DEFAULTS.productName),
    siteUrl: str(env, "VITE_SITE_URL", DEFAULTS.siteUrl),
    robots: oneOf(env, "VITE_ROBOTS", ["index", "noindex"], DEFAULTS.robots),
    envLabel: str(env, "VITE_ENV_LABEL", DEFAULTS.envLabel),
    checkoutUrl: str(env, "VITE_CHECKOUT_URL", DEFAULTS.checkoutUrl),
    unlockProvider: oneOf(env, "VITE_UNLOCK_PROVIDER", ["none", "lemonsqueezy", "gumroad"], DEFAULTS.unlockProvider),
    unlockProductId: str(env, "VITE_UNLOCK_PRODUCT_ID", DEFAULTS.unlockProductId),
    unlockStoreId: str(env, "VITE_UNLOCK_STORE_ID", DEFAULTS.unlockStoreId),
    supportUrl: str(env, "VITE_SUPPORT_URL", DEFAULTS.supportUrl),
    analyticsProvider: oneOf(env, "VITE_ANALYTICS_PROVIDER", ["none", "goatcounter"], DEFAULTS.analyticsProvider),
    analyticsSite: str(env, "VITE_ANALYTICS_SITE", DEFAULTS.analyticsSite),
    featureLogin: str(env, "VITE_FEATURE_LOGIN", "false").toLowerCase() === "true",
    spotifyClientId: str(env, "VITE_SPOTIFY_CLIENT_ID", DEFAULTS.spotifyClientId),
  };
}

/** License-verify host of the chosen provider, or null when unlock is off. */
export function unlockVerifyOrigin(cfg: AppConfig): string | null {
  if (cfg.unlockProvider === "lemonsqueezy") return "https://api.lemonsqueezy.com";
  if (cfg.unlockProvider === "gumroad") return "https://api.gumroad.com";
  return null;
}

/** GoatCounter origin when analytics is enabled and a site code is set, else null. */
export function analyticsOrigin(cfg: AppConfig): string | null {
  if (cfg.analyticsProvider !== "goatcounter" || !/^[a-z0-9-]+$/i.test(cfg.analyticsSite)) return null;
  return `https://${cfg.analyticsSite.toLowerCase()}.goatcounter.com`;
}

/** Spotify hosts for the flagged S2 login, only when the flag and a client ID are both set. */
export function spotifyOrigins(cfg: AppConfig): string[] {
  if (!cfg.featureLogin || cfg.spotifyClientId === "") return [];
  return ["https://accounts.spotify.com", "https://api.spotify.com"];
}

/** The Content-Security-Policy for every HTML page (eng/frontend.md § Config, CSP). */
export function buildCsp(cfg: AppConfig): string {
  const connect = ["'self'", unlockVerifyOrigin(cfg), analyticsOrigin(cfg), ...spotifyOrigins(cfg)].filter(
    (host): host is string => host !== null,
  );
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "worker-src 'self' blob:",
    `connect-src ${connect.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join("; ");
}

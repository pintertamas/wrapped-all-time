import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULTS, buildCsp, parseConfig } from "./configSchema";

function connectSrc(csp: string): string[] {
  const directive = csp.split("; ").find((d) => d.startsWith("connect-src "));
  return directive ? directive.split(" ").slice(1) : [];
}

describe("parseConfig", () => {
  it("falls back to the defaults for missing or empty values", () => {
    expect(parseConfig({})).toEqual(DEFAULTS);
    expect(parseConfig({ VITE_PRODUCT_NAME: "  ", VITE_UNLOCK_PROVIDER: "" })).toEqual(DEFAULTS);
  });

  it("reads and normalises values", () => {
    const cfg = parseConfig({
      BASE_URL: "/wrapped-all-time/",
      VITE_PRODUCT_NAME: "Other Name",
      VITE_ROBOTS: "noindex",
      VITE_ENV_LABEL: "TEST SITE",
      VITE_UNLOCK_PROVIDER: "LemonSqueezy",
      VITE_FEATURE_LOGIN: "TRUE",
    });
    expect(cfg.basePath).toBe("/wrapped-all-time/");
    expect(cfg.productName).toBe("Other Name");
    expect(cfg.robots).toBe("noindex");
    expect(cfg.envLabel).toBe("TEST SITE");
    expect(cfg.unlockProvider).toBe("lemonsqueezy");
    expect(cfg.featureLogin).toBe(true);
  });

  it("rejects unknown enum values", () => {
    const cfg = parseConfig({ VITE_UNLOCK_PROVIDER: "stripe", VITE_ANALYTICS_PROVIDER: "ga", VITE_ROBOTS: "all" });
    expect(cfg.unlockProvider).toBe("none");
    expect(cfg.analyticsProvider).toBe("none");
    expect(cfg.robots).toBe("index");
  });

  it("matches the committed frontend/.env defaults", () => {
    const env: Record<string, string> = {};
    for (const line of readFileSync(join(process.cwd(), ".env"), "utf8").split("\n")) {
      const m = /^(VITE_[A-Z_]+)=(.*)$/.exec(line.trim());
      if (m) env[m[1]] = m[2];
    }
    expect(Object.keys(env).sort()).toEqual(
      [
        "VITE_ANALYTICS_PROVIDER", "VITE_ANALYTICS_SITE", "VITE_BASE_PATH", "VITE_CHECKOUT_URL", "VITE_ENV_LABEL",
        "VITE_FEATURE_LOGIN", "VITE_PRODUCT_NAME", "VITE_ROBOTS", "VITE_SITE_URL", "VITE_SPOTIFY_CLIENT_ID",
        "VITE_SUPPORT_URL", "VITE_UNLOCK_PRODUCT_ID", "VITE_UNLOCK_PROVIDER", "VITE_UNLOCK_STORE_ID",
      ],
    );
    expect(parseConfig(env)).toEqual(DEFAULTS);
  });
});

describe("buildCsp", () => {
  it("allows only self by default", () => {
    const csp = buildCsp(DEFAULTS);
    expect(connectSrc(csp)).toEqual(["'self'"]);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).not.toContain('"');
  });

  it("adds the chosen provider's verify host only", () => {
    expect(connectSrc(buildCsp({ ...DEFAULTS, unlockProvider: "lemonsqueezy" }))).toEqual([
      "'self'",
      "https://api.lemonsqueezy.com",
    ]);
    expect(connectSrc(buildCsp({ ...DEFAULTS, unlockProvider: "gumroad" }))).toEqual(["'self'", "https://api.gumroad.com"]);
  });

  it("adds GoatCounter only when enabled with a site code", () => {
    expect(connectSrc(buildCsp({ ...DEFAULTS, analyticsProvider: "goatcounter" }))).toEqual(["'self'"]);
    expect(connectSrc(buildCsp({ ...DEFAULTS, analyticsSite: "lv" }))).toEqual(["'self'"]);
    expect(connectSrc(buildCsp({ ...DEFAULTS, analyticsProvider: "goatcounter", analyticsSite: "lv" }))).toEqual([
      "'self'",
      "https://lv.goatcounter.com",
    ]);
    expect(connectSrc(buildCsp({ ...DEFAULTS, analyticsProvider: "goatcounter", analyticsSite: "x y;" }))).toEqual([
      "'self'",
    ]);
  });

  it("adds Spotify hosts only with the login flag and a client id", () => {
    expect(connectSrc(buildCsp({ ...DEFAULTS, featureLogin: true }))).toEqual(["'self'"]);
    expect(connectSrc(buildCsp({ ...DEFAULTS, spotifyClientId: "abc" }))).toEqual(["'self'"]);
    expect(connectSrc(buildCsp({ ...DEFAULTS, featureLogin: true, spotifyClientId: "abc" }))).toEqual([
      "'self'",
      "https://accounts.spotify.com",
      "https://api.spotify.com",
    ]);
  });
});

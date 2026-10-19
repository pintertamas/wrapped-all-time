import { join } from "node:path";
import { loadEnv } from "vite";
import { parseConfig, type AppConfig } from "../src/configSchema.ts";

export const fixture = (name: string): string => join(import.meta.dirname, "..", ".fixtures", name);

/** Second preview of a build with the Lemon Squeezy verifier switched on (see playwright.config.ts). */
export const VERIFY_PORT = 4174;
export const verifyBase = (): string => `http://localhost:${VERIFY_PORT}${process.env.VITE_BASE_PATH || "/"}`;
export const VERIFY_ENV = {
  VITE_UNLOCK_PROVIDER: "lemonsqueezy",
  VITE_UNLOCK_PRODUCT_ID: "111",
  VITE_UNLOCK_STORE_ID: "222",
};

/** The config the main build used: committed .env defaults overridden by non-empty VITE_* variables. */
export function buildConfig(overrides: Record<string, string> = {}): AppConfig {
  const env: Record<string, string> = { ...loadEnv("production", join(import.meta.dirname, ".."), "VITE_") };
  for (const [k, v] of Object.entries(process.env)) if (k.startsWith("VITE_") && v) env[k] = v;
  return parseConfig({ ...env, ...overrides });
}

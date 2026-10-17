// The only module that reads import.meta.env (enforced by config.test.ts).
// Values are public build-time settings: defaults in frontend/.env, overridden by CI variables.
import { parseConfig } from "./configSchema";

export type { AnalyticsProvider, AppConfig, UnlockProvider } from "./configSchema";

export const config = parseConfig(import.meta.env);

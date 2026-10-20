// Provider-agnostic unlock verification. The browser calls the payment provider's license-verify
// endpoint directly (CORS confirmed, eng/frontend.md § Unlock verification). Nothing is stored here.
import { config as appConfig } from "../config";
import type { AppConfig } from "../configSchema";
import { createLemonSqueezyVerifier } from "./verifiers/lemonsqueezy";

export { MAX_KEY_LENGTH, normalizeKey } from "./key";

export type VerifyFailure = "invalid" | "wrong-product" | "refunded" | "offline" | "provider-error";

export type VerifyResult = { ok: true } | { ok: false; reason: VerifyFailure };

export interface UnlockVerifier {
  verify(key: string): Promise<VerifyResult>;
}

/** Used while VITE_UNLOCK_PROVIDER=none: makes no request and never unlocks. */
export const comingSoonVerifier: UnlockVerifier = {
  verify: () => Promise.resolve({ ok: false, reason: "provider-error" }),
};

/** The verifier for the configured provider. `fetchImpl` is injectable for tests. */
export function createVerifier(
  cfg: Pick<AppConfig, "unlockProvider" | "unlockProductId" | "unlockStoreId"> = appConfig,
  fetchImpl?: typeof fetch,
): UnlockVerifier {
  switch (cfg.unlockProvider) {
    case "lemonsqueezy":
      return createLemonSqueezyVerifier({
        productId: cfg.unlockProductId,
        storeId: cfg.unlockStoreId,
        fetchImpl,
      });
    // "gumroad" is a later task behind this interface (owner picked Lemon Squeezy, D3).
    default:
      return comingSoonVerifier;
  }
}

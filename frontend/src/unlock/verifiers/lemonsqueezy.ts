// Lemon Squeezy license check: POST /v1/licenses/validate with the key as the only form field.
// The response carries the buyer's email; it is read for the checks below and then dropped. This
// module never stores or logs the key or any part of the response.
import { normalizeKey } from "../key";
import type { UnlockVerifier, VerifyResult } from "../verifier";

export const LEMON_SQUEEZY_VALIDATE_URL = "https://api.lemonsqueezy.com/v1/licenses/validate";
const DEFAULT_TIMEOUT_MS = 10_000;

export interface LemonSqueezyOptions {
  productId: string;
  storeId: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const fail = (reason: Extract<VerifyResult, { ok: false }>["reason"]): VerifyResult => ({ ok: false, reason });

function idMatches(actual: unknown, expected: string): boolean {
  if (expected === "") return false;
  if (typeof actual !== "number" && typeof actual !== "string") return false;
  return String(actual) === expected;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

export function createLemonSqueezyVerifier(opts: LemonSqueezyOptions): UnlockVerifier {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return {
    async verify(rawKey: string): Promise<VerifyResult> {
      const key = normalizeKey(rawKey);
      if (key === null) return fail("invalid");
      // Without configured IDs we cannot tell whose key this is: fail closed, send nothing.
      if (opts.productId === "" || opts.storeId === "") return fail("provider-error");

      const doFetch = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await doFetch(LEMON_SQUEEZY_VALIDATE_URL, {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ license_key: key }).toString(),
          credentials: "omit",
          cache: "no-store",
          referrerPolicy: "no-referrer",
          signal: controller.signal,
        });
      } catch {
        // Aborted by our timeout: the provider is not answering. Anything else: no connection.
        return fail(controller.signal.aborted ? "provider-error" : "offline");
      } finally {
        clearTimeout(timer);
      }

      if (response.status === 400 || response.status === 404) return fail("invalid");
      if (response.status !== 200) return fail("provider-error");

      let body: Record<string, unknown> | null;
      try {
        body = record(await response.json());
      } catch {
        return fail("provider-error");
      }
      if (body === null) return fail("provider-error");

      const license = record(body.license_key);
      const status = license?.status;
      if (body.valid !== true) {
        // A disabled key is what a refund or manual revoke leaves behind.
        if (status === "disabled") return fail("refunded");
        return fail("invalid");
      }
      if (status !== "active" && status !== "inactive") {
        return fail(status === "disabled" ? "refunded" : "invalid");
      }
      const meta = record(body.meta);
      if (meta === null) return fail("provider-error");
      if (!idMatches(meta.store_id, opts.storeId) || !idMatches(meta.product_id, opts.productId)) {
        return fail("wrong-product");
      }
      return { ok: true };
    },
  };
}

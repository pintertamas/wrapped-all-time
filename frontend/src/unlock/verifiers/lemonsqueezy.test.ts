import { afterEach, describe, expect, it, vi } from "vitest";
import { createLemonSqueezyVerifier, LEMON_SQUEEZY_VALIDATE_URL } from "./lemonsqueezy";

const KEY = "38b1460a-5104-4067-a91d-77b872934d51";
const PRODUCT = "4242";
const STORE = "99";

function good(over: { valid?: boolean; status?: string; store_id?: unknown; product_id?: unknown } = {}) {
  return {
    valid: over.valid ?? true,
    error: null,
    license_key: { id: 1, status: over.status ?? "active", key: KEY, activation_limit: 0 },
    instance: null,
    meta: {
      store_id: over.store_id ?? 99,
      order_id: 7,
      product_id: over.product_id ?? 4242,
      customer_name: "Buyer",
      customer_email: "buyer@example.com",
    },
  };
}

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

function verifierWith(fetchImpl: typeof fetch, timeoutMs?: number) {
  return createLemonSqueezyVerifier({ productId: PRODUCT, storeId: STORE, fetchImpl, timeoutMs });
}

afterEach(() => vi.useRealTimers());

describe("lemon squeezy verifier", () => {
  it("accepts a valid active key with the exact request", async () => {
    const f = vi.fn<typeof fetch>(() => json(good()));
    await expect(verifierWith(f).verify(`  ${KEY}\n`)).resolves.toEqual({ ok: true });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe(LEMON_SQUEEZY_VALIDATE_URL);
    expect(url).toBe("https://api.lemonsqueezy.com/v1/licenses/validate");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(`license_key=${KEY}`);
    expect(init?.headers).toEqual({
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    });
    expect(init?.credentials).toBe("omit");
  });

  it("accepts an inactive (never activated) key and string ids", async () => {
    const f = vi.fn<typeof fetch>(() => json(good({ status: "inactive", store_id: "99", product_id: "4242" })));
    await expect(verifierWith(f).verify(KEY)).resolves.toEqual({ ok: true });
  });

  it.each([400, 404])("maps HTTP %i to invalid", async (status) => {
    const f = vi.fn<typeof fetch>(() => json({ valid: false, error: "license_key not found." }, status));
    await expect(verifierWith(f).verify(KEY)).resolves.toEqual({ ok: false, reason: "invalid" });
  });

  it("maps valid:false on HTTP 200 to invalid", async () => {
    const f = vi.fn<typeof fetch>(() => json(good({ valid: false, status: "expired" })));
    await expect(verifierWith(f).verify(KEY)).resolves.toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects a key from another product", async () => {
    const f = vi.fn<typeof fetch>(() => json(good({ product_id: 5 })));
    await expect(verifierWith(f).verify(KEY)).resolves.toEqual({ ok: false, reason: "wrong-product" });
  });

  it("rejects a key from another store", async () => {
    const f = vi.fn<typeof fetch>(() => json(good({ store_id: 1 })));
    await expect(verifierWith(f).verify(KEY)).resolves.toEqual({ ok: false, reason: "wrong-product" });
  });

  it("rejects missing or non-scalar ids", async () => {
    const f = vi.fn<typeof fetch>(() => json(good({ store_id: null, product_id: { a: 1 } })));
    await expect(verifierWith(f).verify(KEY)).resolves.toEqual({ ok: false, reason: "wrong-product" });
  });

  it("maps a disabled (refunded) key to refunded, with or without valid:true", async () => {
    const f1 = vi.fn<typeof fetch>(() => json(good({ valid: false, status: "disabled" })));
    await expect(verifierWith(f1).verify(KEY)).resolves.toEqual({ ok: false, reason: "refunded" });
    const f2 = vi.fn<typeof fetch>(() => json(good({ valid: true, status: "disabled" })));
    await expect(verifierWith(f2).verify(KEY)).resolves.toEqual({ ok: false, reason: "refunded" });
  });

  it("treats a valid:true answer with an unknown status as invalid", async () => {
    const f = vi.fn<typeof fetch>(() => json(good({ status: "expired" })));
    await expect(verifierWith(f).verify(KEY)).resolves.toEqual({ ok: false, reason: "invalid" });
  });

  it("reports offline when fetch rejects", async () => {
    const f = vi.fn<typeof fetch>(() => Promise.reject(new TypeError("Failed to fetch")));
    await expect(verifierWith(f).verify(KEY)).resolves.toEqual({ ok: false, reason: "offline" });
  });

  it.each([429, 500, 503, 201, 302])("maps HTTP %i to provider-error", async (status) => {
    const f = vi.fn<typeof fetch>(() => json(good(), status));
    await expect(verifierWith(f).verify(KEY)).resolves.toEqual({ ok: false, reason: "provider-error" });
  });

  it("maps a non-JSON or malformed 200 body to provider-error", async () => {
    const html = vi.fn<typeof fetch>(() => Promise.resolve(new Response("<html>oops</html>", { status: 200 })));
    await expect(verifierWith(html).verify(KEY)).resolves.toEqual({ ok: false, reason: "provider-error" });
    const arr = vi.fn<typeof fetch>(() => json(null));
    await expect(verifierWith(arr).verify(KEY)).resolves.toEqual({ ok: false, reason: "provider-error" });
    const noMeta = vi.fn<typeof fetch>(() => json({ valid: true, license_key: { status: "active" } }));
    await expect(verifierWith(noMeta).verify(KEY)).resolves.toEqual({ ok: false, reason: "provider-error" });
  });

  it("maps a timeout to provider-error", async () => {
    vi.useFakeTimers();
    const f = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const p = verifierWith(f, 50).verify(KEY);
    await vi.advanceTimersByTimeAsync(60);
    await expect(p).resolves.toEqual({ ok: false, reason: "provider-error" });
  });

  it("sends nothing for an empty or oversized key", async () => {
    const f = vi.fn<typeof fetch>(() => json(good()));
    const v = verifierWith(f);
    await expect(v.verify("   ")).resolves.toEqual({ ok: false, reason: "invalid" });
    await expect(v.verify("x".repeat(500))).resolves.toEqual({ ok: false, reason: "invalid" });
    expect(f).not.toHaveBeenCalled();
  });

  it("fails closed without configured ids and sends nothing", async () => {
    const f = vi.fn<typeof fetch>(() => json(good()));
    const v = createLemonSqueezyVerifier({ productId: "", storeId: STORE, fetchImpl: f });
    await expect(v.verify(KEY)).resolves.toEqual({ ok: false, reason: "provider-error" });
    expect(f).not.toHaveBeenCalled();
  });
});

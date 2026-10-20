import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isUnlocked, readCodeFromHash, redeemKey, writeEntitlement } from "./entitlement";
import { createLemonSqueezyVerifier } from "./verifiers/lemonsqueezy";

const KEY = "38b1460a-5104-4067-a91d-77b872934d51";
const EMAIL = "buyer@example.com";

describe("isUnlocked", () => {
  beforeEach(() => localStorage.clear());
  it("is false without a record or with junk", () => {
    expect(isUnlocked()).toBe(false);
    localStorage.setItem("lv.unlock.v1", "nope");
    expect(isUnlocked()).toBe(false);
  });
  it("is true for a valid record", () => {
    localStorage.setItem("lv.unlock.v1", JSON.stringify({ v: 1, keyLast4: "ABCD" }));
    expect(isUnlocked()).toBe(true);
  });
});

describe("writeEntitlement", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("stores exactly v, provider, keyLast4 and verifiedAt", () => {
    expect(writeEntitlement("lemonsqueezy", KEY, new Date("2026-10-19T10:00:00Z"))).toBe(true);
    expect(JSON.parse(localStorage.getItem("lv.unlock.v1") ?? "")).toEqual({
      v: 1,
      provider: "lemonsqueezy",
      keyLast4: "4d51",
      verifiedAt: "2026-10-19T10:00:00.000Z",
    });
    expect(isUnlocked()).toBe(true);
  });

  it("returns false when storage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(writeEntitlement("lemonsqueezy", KEY)).toBe(false);
  });
});

describe("redeemKey", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  const body = (over: Record<string, unknown> = {}) => ({
    valid: true,
    license_key: { id: 1, status: "active", key: KEY },
    meta: { store_id: 99, product_id: 4242, customer_email: EMAIL, customer_name: "Buyer" },
    ...over,
  });
  const verifier = (b: unknown, status = 200) =>
    createLemonSqueezyVerifier({
      productId: "4242",
      storeId: "99",
      fetchImpl: () => Promise.resolve(new Response(JSON.stringify(b), { status })),
    });

  it("writes the entitlement on success and never stores or logs the key or the email", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    await expect(redeemKey(KEY, verifier(body()), "lemonsqueezy")).resolves.toEqual({ ok: true });

    const stored = { ...localStorage };
    expect(Object.keys(stored)).toEqual(["lv.unlock.v1"]);
    expect(Object.keys(JSON.parse(stored["lv.unlock.v1"])).sort()).toEqual(["keyLast4", "provider", "v", "verifiedAt"]);
    const everything = JSON.stringify(stored) + JSON.stringify({ ...sessionStorage });
    expect(everything).not.toContain(KEY);
    expect(everything).not.toContain(EMAIL);
    expect(everything).not.toContain("Buyer");
    for (const s of spies) expect(s).not.toHaveBeenCalled();
    expect(isUnlocked()).toBe(true);
  });

  it("writes nothing and logs nothing on every failure", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const failures = [
      verifier({ valid: false }, 404),
      verifier(body({ meta: { store_id: 1, product_id: 4242 } })),
      verifier(body({ valid: false, license_key: { status: "disabled" } })),
      verifier({}, 500),
      createLemonSqueezyVerifier({ productId: "4242", storeId: "99", fetchImpl: () => Promise.reject(new TypeError("x")) }),
    ];
    for (const v of failures) {
      const r = await redeemKey(KEY, v, "lemonsqueezy");
      expect(r.ok).toBe(false);
    }
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    for (const s of spies) expect(s).not.toHaveBeenCalled();
  });

  it("rejects an empty key without calling the verifier", async () => {
    const verify = vi.fn();
    await expect(redeemKey("  ", { verify }, "lemonsqueezy")).resolves.toEqual({ ok: false, reason: "invalid" });
    expect(verify).not.toHaveBeenCalled();
  });

  it("does not unlock when the provider is none", async () => {
    await expect(redeemKey(KEY, { verify: () => Promise.resolve({ ok: true }) }, "none")).resolves.toEqual({
      ok: false,
      reason: "provider-error",
    });
    expect(localStorage.length).toBe(0);
  });

  it("reports storage-blocked when the record cannot be written", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    await expect(redeemKey(KEY, verifier(body()), "lemonsqueezy")).resolves.toEqual({
      ok: false,
      reason: "storage-blocked",
    });
  });
});

describe("readCodeFromHash", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("returns the code and removes it from the URL without adding history", () => {
    window.history.replaceState(null, "", `/?x=1#/unlock?code=${KEY}`);
    const before = window.history.length;
    expect(readCodeFromHash()).toBe(KEY);
    expect(window.location.hash).toBe("#/unlock");
    expect(window.location.search).toBe("?x=1");
    expect(window.location.href).not.toContain(KEY);
    expect(window.history.length).toBe(before);
    expect(readCodeFromHash()).toBeNull();
  });

  it("returns null and leaves other hashes alone", () => {
    window.history.replaceState(null, "", "/#/recap/12m");
    expect(readCodeFromHash()).toBeNull();
    expect(window.location.hash).toBe("#/recap/12m");
    window.history.replaceState(null, "", "/#/unlock");
    expect(readCodeFromHash()).toBeNull();
  });
});

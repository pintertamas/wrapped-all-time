import { describe, expect, it, vi } from "vitest";
import { DEFAULTS } from "../configSchema";
import { comingSoonVerifier, createVerifier } from "./verifier";

describe("createVerifier", () => {
  it("returns the coming-soon verifier for provider none, with no request", async () => {
    const f = vi.fn<typeof fetch>();
    const v = createVerifier({ ...DEFAULTS, unlockProvider: "none" }, f);
    expect(v).toBe(comingSoonVerifier);
    await expect(v.verify("KEY")).resolves.toEqual({ ok: false, reason: "provider-error" });
    expect(f).not.toHaveBeenCalled();
  });

  it("builds the Lemon Squeezy verifier from config", async () => {
    const f = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify({ valid: true, license_key: { status: "active" }, meta: { store_id: 2, product_id: 1 } })),
      ),
    );
    const v = createVerifier({ unlockProvider: "lemonsqueezy", unlockProductId: "1", unlockStoreId: "2" }, f);
    await expect(v.verify("KEY")).resolves.toEqual({ ok: true });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("falls back to coming soon for a provider that is not built yet", async () => {
    const v = createVerifier({ unlockProvider: "gumroad", unlockProductId: "1", unlockStoreId: "" });
    await expect(v.verify("KEY")).resolves.toEqual({ ok: false, reason: "provider-error" });
  });
});

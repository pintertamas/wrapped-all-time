import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cfg = vi.hoisted(() => ({
  checkoutUrl: "https://shop.example/buy",
  supportUrl: "",
  unlockProvider: "lemonsqueezy",
}));
vi.mock("../config", () => ({ config: cfg }));

import { RECAP_KEY, UNLOCK_KEY } from "../storage/keys";
import UnlockSheet, { FAILURE_MESSAGES } from "./UnlockSheet";
import type { UnlockVerifier, VerifyResult } from "./verifier";

const verifierOf = (r: VerifyResult): UnlockVerifier => ({ verify: vi.fn(() => Promise.resolve(r)) });

async function submitKey(value: string) {
  fireEvent.change(screen.getByLabelText("License key"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
}

beforeEach(() => {
  cfg.checkoutUrl = "https://shop.example/buy";
  cfg.supportUrl = "";
  cfg.unlockProvider = "lemonsqueezy";
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "#/unlock";
});
afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("UnlockSheet", () => {
  it("shows the offer and checkout link, or Coming soon when empty", () => {
    const { unmount } = render(<UnlockSheet code={null} />);
    expect(screen.getByText(/One-time unlock for \$4\.99/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Buy for/ }).getAttribute("href")).toBe("https://shop.example/buy");
    unmount();
    cfg.checkoutUrl = "";
    render(<UnlockSheet code={null} />);
    expect(screen.getByText("Coming soon.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Buy for/ })).toBeNull();
  });

  it("stores only the entitlement on success", async () => {
    render(<UnlockSheet code={null} verifier={verifierOf({ ok: true })} />);
    await submitKey("  ABCD-1234-WXYZ  ");
    await screen.findByRole("status");
    const rec = JSON.parse(localStorage.getItem(UNLOCK_KEY) ?? "null");
    expect(rec.keyLast4).toBe("WXYZ");
    expect(localStorage.getItem(UNLOCK_KEY)).not.toContain("ABCD-1234");
  });

  for (const reason of ["invalid", "wrong-product", "refunded", "offline", "provider-error"] as const) {
    it(`shows its own message for ${reason}`, async () => {
      render(<UnlockSheet code={null} verifier={verifierOf({ ok: false, reason })} />);
      await submitKey("some-key");
      expect((await screen.findByRole("alert")).textContent).toBe(FAILURE_MESSAGES[reason]);
      expect(localStorage.getItem(UNLOCK_KEY)).toBeNull();
    });
  }

  it("has distinct failure messages", () => {
    expect(new Set(Object.values(FAILURE_MESSAGES)).size).toBe(Object.keys(FAILURE_MESSAGES).length);
  });

  it("shows the lost-key link only with a support URL", () => {
    const { unmount } = render(<UnlockSheet code={null} />);
    expect(screen.queryByText("Lost your key?")).toBeNull();
    unmount();
    cfg.supportUrl = "mailto:help@example.com";
    render(<UnlockSheet code={null} />);
    expect(screen.getByText("Lost your key?").getAttribute("href")).toBe("mailto:help@example.com");
  });

  it("prefills the field from the code and strips it from the URL", () => {
    window.location.hash = "#/unlock?code=PRE-FILLED";
    render(<UnlockSheet code="PRE-FILLED" />);
    expect((screen.getByLabelText("License key") as HTMLInputElement).value).toBe("PRE-FILLED");
    expect(window.location.hash).toBe("#/unlock");
  });

  it("warns when only Account Data is loaded", async () => {
    sessionStorage.setItem(RECAP_KEY, JSON.stringify({ v: 1, stats: { version: 1, sources: ["account"], sample: false } }));
    render(<UnlockSheet code={null} />);
    await waitFor(() => expect(screen.getByText(/adds years only if you load the Extended history/)).toBeTruthy());
  });

  it("omits the warning for Extended data or no data", () => {
    render(<UnlockSheet code={null} />);
    expect(screen.queryByText(/adds years only/)).toBeNull();
  });
});
